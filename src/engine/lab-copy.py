#!/usr/bin/env python3
"""Host-only module transactions against an explicitly initialized CMU filesystem copy."""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys


class Refused(Exception):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_regular(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise Refused('Expected a regular file: ' + str(path))
        return stream.read()


def fsync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_new(path, data, mode=0o600):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def save_json(path, data):
    temp = path.with_name(path.name + '.new')
    if temp.exists() or temp.is_symlink():
        # Only this exact journal scratch filename is ours; never follow a symlink.
        if temp.is_symlink() or not temp.is_file():
            raise Refused('Unsafe journal scratch file')
        temp.unlink()
    write_new(temp, (json.dumps(data, ensure_ascii=True, sort_keys=True, indent=2) + '\n').encode())
    os.replace(temp, path)
    fsync_dir(path.parent)


def load_json(path):
    try:
        return json.loads(read_regular(path))
    except (ValueError, UnicodeDecodeError) as error:
        raise Refused('Invalid JSON: ' + str(path)) from error


def relative(value):
    if not isinstance(value, str) or not value or '\\' in value or '\0' in value:
        raise Refused('Invalid path')
    p = PurePosixPath(value)
    if p.is_absolute() or any(x in ('', '.', '..') for x in value.split('/')):
        raise Refused('Path traversal or ambiguous path: ' + value)
    return p


def checked_path(root, value):
    p = relative(value)
    current = root
    if current.is_symlink():
        raise Refused('Symlink root refused')
    for part in p.parts:
        current = current / part
        if current.is_symlink():
            raise Refused('Symlink refused: ' + str(current))
        if current.exists() and current != root / p and not current.is_dir():
            raise Refused('Parent is not a directory')
    return current


def file_hash(path):
    if path.is_symlink():
        raise Refused('Symlink refused')
    return digest(read_regular(path)) if path.exists() else None


def fault(point):
    """Test hook: a real ungraceful process exit, only inside a marked lab."""
    if os.environ.get('CMU_LAB_FAULT') == point:
        os._exit(86)


def inventory(root):
    result = {}
    for p in sorted(root.rglob('*')):
        if p.is_symlink():
            raise Refused('Source symlink cannot be represented by this host lab')
        if p.is_file():
            s = p.stat()
            result[p.relative_to(root).as_posix()] = {'sha256': digest(read_regular(p)),
                                                     'mode': stat.S_IMODE(s.st_mode), 'size': s.st_size}
        elif not p.is_dir():
            raise Refused('Special source node refused')
    return result


def init_copy(source, destination):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).absolute()
    if destination.exists() or destination.is_symlink():
        raise Refused('Destination already exists')
    actual = destination.resolve()
    if source == actual or source in actual.parents or actual in source.parents:
        raise Refused('Source and lab must be disjoint')
    version = read_regular(source / 'jci/version.ini')
    before = inventory(source)
    needed = sum(x['size'] for x in before.values())
    destination.parent.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(destination.parent).free < needed * 2 + 16 * 1024 * 1024:
        raise Refused('Insufficient space for independent copy and working room')
    destination.mkdir()
    shutil.copytree(source, destination / 'rootfs', copy_function=shutil.copy2)
    copied = inventory(destination / 'rootfs')
    if copied != before:
        raise Refused('Copy verification failed; no usable lab marker was created')
    # Re-read source to detect changes during the copy. No hard links or in-place source writes.
    if inventory(source) != before:
        raise Refused('Source changed while copying')
    save_json(destination / 'baseline.json', before)
    (destination / 'state').mkdir()
    (destination / 'state/transactions').mkdir()
    marker = {'schema': 1, 'lab_only': True, 'lab_directory': str(destination.resolve()),
              'source': str(source), 'version_sha256': digest(version),
              'baseline_sha256': digest(read_regular(destination / 'baseline.json')),
              'files': len(before), 'bytes': needed, 'representation': 'independent copy of extracted regular files'}
    save_json(destination / 'cmu-next-lab.json', marker)
    return marker

