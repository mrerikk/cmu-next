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


class Lab:
    def __init__(self, folder):
        raw = Path(folder).absolute()
        if raw.is_symlink():
            raise Refused('Lab symlink refused')
        self.folder = raw.resolve(strict=True)
        self.marker = load_json(self.folder / 'cmu-next-lab.json')
        if self.marker.get('schema') != 1 or self.marker.get('lab_only') is not True:
            raise Refused('Not a marked lab')
        if self.marker.get('lab_directory') != str(self.folder):
            raise Refused('Lab location does not match marker')
        if self.folder == Path('/') or Path(self.marker['source']) == self.folder / 'rootfs':
            raise Refused('Live/source filesystem refused')
        self.root = checked_path(self.folder, 'rootfs')
        self.state = checked_path(self.folder, 'state')
        self.transactions = checked_path(self.folder, 'state/transactions')
        if digest(read_regular(self.folder / 'baseline.json')) != self.marker['baseline_sha256']:
            raise Refused('Baseline inventory is damaged')

    @contextlib.contextmanager
    def locked(self):
        fd = os.open(self.state / 'lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise Refused('Another lab transaction is running') from error
            yield
        finally:
            os.close(fd)

    def check_version(self):
        if file_hash(checked_path(self.root, 'jci/version.ini')) != self.marker['version_sha256']:
            raise Refused('Firmware version changed since lab initialization')

    def journals(self):
        journals = []
        for p in sorted(self.transactions.iterdir()):
            if not re.fullmatch(r't[0-9]{6}', p.name) or p.is_symlink() or not p.is_dir():
                raise Refused('Unexpected transaction directory')
            journal = p / 'journal.json'
            if journal.exists():
                journals.append(load_json(journal))
            else:
                # A crash during staging cannot have modified rootfs yet.
                journals.append({'id': p.name, 'status': 'incomplete-staging', 'entries': []})
        return journals

    def module(self, directory):
        directory = Path(directory).resolve(strict=True)
        raw = read_regular(directory / 'module.json')
        m = json.loads(raw)
        if set(m) != {'schema', 'id', 'version', 'firmware', 'files'} or m['schema'] != 1:
            raise Refused('Unsupported module schema')
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', m['id']):
            raise Refused('Invalid module id')
        if not isinstance(m['version'], str) or not m['version']:
            raise Refused('Invalid module version')
        if m['firmware'] != {'version_sha256': self.marker['version_sha256']}:
            raise Refused('Module is for a different firmware')
        if not isinstance(m['files'], list) or not 1 <= len(m['files']) <= 256:
            raise Refused('Invalid file count')
        seen, total = set(), 0
        for entry in m['files']:
            if set(entry) != {'path', 'before_sha256', 'after_sha256', 'payload', 'mode'}:
                raise Refused('Invalid file entry')
            rel = relative(entry['path'])
            if not str(rel).startswith('jci/gui/') or str(rel) in ('jci/gui',):
                raise Refused('This lab engine only accepts GUI module destinations')
            if str(rel).casefold() in seen:
                raise Refused('Duplicate/case-colliding destination')
            seen.add(str(rel).casefold())
            for key in ('before_sha256', 'after_sha256'):
                if entry[key] is None and key == 'before_sha256':
                    continue
                if not isinstance(entry[key], str) or not re.fullmatch('[0-9a-f]{64}', entry[key]):
                    raise Refused('Invalid file checksum')
            if entry['before_sha256'] == entry['after_sha256']:
                raise Refused('No-op entries are not supported; metadata-only modules need an explicit format')
            if type(entry['mode']) is not int or entry['mode'] not in (0o644, 0o755):
                raise Refused('Unsupported mode')
            payload = checked_path(directory, entry['payload'])
            data = read_regular(payload)
            if digest(data) != entry['after_sha256']:
                raise Refused('Payload checksum mismatch')
            total += len(data)
            if len(data) > 16 * 1024 * 1024 or total > 64 * 1024 * 1024:
                raise Refused('Module exceeds lab size limits')
            checked_path(self.root, entry['path'])
        canonical = json.dumps(m, sort_keys=True, separators=(',', ':')).encode()
        targets = sorted(seen)
        if any(right.startswith(left + '/') for left, right in zip(targets, targets[1:])):
            raise Refused('Destination files cannot also be parent directories')
        return m, digest(canonical), directory

    def _plan(self, directory):
        self.check_version()
        m, key, directory = self.module(directory)
        journals = self.journals()
        pending = [t for t in journals if t['status'] not in ('installed', 'restored', 'aborted', 'incomplete-staging')]
        if pending:
            raise Refused('Recover pending transaction first: ' + pending[0]['id'])
        installed = [t for t in journals if t['status'] == 'installed']
        same = [t for t in installed if t['module_id'] == m['id']]
        if same:
            t = same[-1]
            if t['module_digest'] != key:
                raise Refused('Restore the installed module before replacing its version')
            if all(file_hash(checked_path(self.root, e['path'])) == e['after_sha256']
                   and stat.S_IMODE(checked_path(self.root, e['path']).stat().st_mode) == e['mode'] for e in t['entries']):
                return {'action': 'already-installed', 'transaction': t['id'], 'module_id': m['id']}, m, key, directory
            raise Refused('Installed module was changed outside the installer')
        owners = {e['path'].casefold(): t['id'] for t in installed for e in t['entries']}
        for entry in m['files']:
            if entry['path'].casefold() in owners:
                raise Refused('Destination is owned by another installed module')
            if file_hash(checked_path(self.root, entry['path'])) != entry['before_sha256']:
                raise Refused('Destination does not match the declared original: ' + entry['path'])
        return {'action': 'install', 'module_id': m['id'], 'files': [e['path'] for e in m['files']]}, m, key, directory

    def plan(self, directory):
        with self.locked():
            return self._plan(directory)[0]

    def _journal(self, tx):
        if not re.fullmatch(r't[0-9]{6}', tx):
            raise Refused('Invalid transaction id')
        folder = checked_path(self.transactions, tx)
        if not folder.is_dir():
            raise Refused('No such transaction')
        return folder, folder / 'journal.json'

    def _replace(self, target, data, mode, scratch, mtime_ns=None, fault_point=None):
        # Same-directory stage and rename guarantee a complete old or new leaf file.
        target = checked_path(self.root, target.relative_to(self.root).as_posix())
        target.parent.mkdir(parents=True, exist_ok=True)
        temp = checked_path(self.root, scratch)
        if temp.parent != target.parent:
            raise Refused('Atomic stage must share the destination directory')
        if temp.exists() or temp.is_symlink():
            raise Refused('Unexpected target staging file')
        write_new(temp, data, mode)
        if digest(read_regular(temp)) != digest(data):
            raise Refused('Target stage verification failed')
        os.chmod(temp, mode)
        if mtime_ns is not None:
            os.utime(temp, ns=(mtime_ns, mtime_ns))
        with open(temp, 'rb') as stream:
            os.fsync(stream.fileno())
        if fault_point:
            fault(fault_point)
        os.replace(temp, target)
        fsync_dir(target.parent)

    def apply(self, directory):
        with self.locked():
            plan, m, key, package = self._plan(directory)
            if plan['action'] == 'already-installed':
                return plan
            ids = [int(p.name[1:]) for p in self.transactions.iterdir() if re.fullmatch(r't[0-9]{6}', p.name)]
            tx = 't%06d' % (max(ids, default=0) + 1)
            folder = self.transactions / tx
            folder.mkdir()
            (folder / 'originals').mkdir()
            (folder / 'payload').mkdir()
            required = sum(len(read_regular(checked_path(package, e['payload']))) * 3 for e in m['files'])
            if shutil.disk_usage(self.folder).free < required + 4 * 1024 * 1024:
                raise Refused('Insufficient transaction space')
            journal = {'schema': 1, 'id': tx, 'module_id': m['id'], 'module_digest': key,
                       'version_sha256': self.marker['version_sha256'], 'status': 'prepared', 'entries': [], 'created_dirs': []}
            for i, item in enumerate(m['files']):
                e = dict(item)
                target = checked_path(self.root, e['path'])
                current = file_hash(target)
                if current != e['before_sha256']:
                    raise Refused('Destination changed before backup')
                e['backup'] = 'originals/%04d.bin' % i if current is not None else None
                e['staged'] = 'payload/%04d.bin' % i
                e['scratch'] = (target.parent / ('.cmu-next-' + tx + '-%04d.stage' % i)).relative_to(self.root).as_posix()
                if checked_path(self.root, e['scratch']).exists():
                    raise Refused('Target scratch filename already exists')
                e['old_metadata'] = None
                if current is not None:
                    s = target.stat()
                    e['old_metadata'] = {'mode': stat.S_IMODE(s.st_mode), 'mtime_ns': s.st_mtime_ns,
                                         'uid': s.st_uid, 'gid': s.st_gid}
                    write_new(folder / e['backup'], read_regular(target))
                    if file_hash(folder / e['backup']) != current:
                        raise Refused('Backup verification failed')
                write_new(folder / e['staged'], read_regular(checked_path(package, e['payload'])))
                if file_hash(folder / e['staged']) != e['after_sha256']:
                    raise Refused('Staged payload verification failed')
                parent = target.parent
                while parent != self.root and not parent.exists():
                    rel = parent.relative_to(self.root).as_posix()
                    if rel not in journal['created_dirs']:
                        journal['created_dirs'].append(rel)
                    parent = parent.parent
                journal['entries'].append(e)
            fsync_dir(folder / 'originals')
            fsync_dir(folder / 'payload')
            save_json(folder / 'journal.json', journal)
            fsync_dir(self.transactions)
            fault('after-prepared')
            try:
                journal['status'] = 'installing'
                save_json(folder / 'journal.json', journal)
                for i, e in enumerate(journal['entries']):
                    target = checked_path(self.root, e['path'])
                    if file_hash(target) != e['before_sha256']:
                        raise Refused('Destination changed during installation')
                    self._replace(target, read_regular(folder / e['staged']), e['mode'], e['scratch'],
                                  fault_point='before-replace:%d' % (i + 1))
                    fault('after-replace:%d' % (i + 1))
                    if file_hash(target) != e['after_sha256']:
                        raise Refused('Installed file verification failed')
                    journal['verified_files'] = i + 1
                    save_json(folder / 'journal.json', journal)
                journal['status'] = 'installed'
                save_json(folder / 'journal.json', journal)
            except Exception:
                # Any normal failure gets the same guarded recovery as a restarted process.
                self._restore(journal, folder)
                raise
            return {'action': 'installed', 'transaction': tx, 'module_id': m['id'], 'files': len(journal['entries'])}

    def _restore(self, journal, folder):
        self.check_version()
        if journal.get('version_sha256') != self.marker['version_sha256']:
            raise Refused('Transaction belongs to another firmware')
        entries = journal['entries']
        # Validate the whole recovery set before modifying any destination.
        for e in entries:
            if not str(relative(e['path'])).startswith('jci/gui/'):
                raise Refused('Invalid transaction destination')
            target = checked_path(self.root, e['path'])
            scratch = checked_path(self.root, e['scratch'])
            if scratch.parent != target.parent or not re.fullmatch(r'\.cmu-next-' + journal['id'] + r'-[0-9]{4}\.stage', scratch.name):
                raise Refused('Invalid transaction scratch path')
            if scratch.exists() and file_hash(scratch) not in (e['before_sha256'], e['after_sha256']):
                raise Refused('Scratch file was changed outside the installer')
            current = file_hash(target)
            if current not in (e['before_sha256'], e['after_sha256']):
                raise Refused('Restore conflict; external changes preserved: ' + e['path'])
            if e['backup'] is not None:
                backup = checked_path(folder, e['backup'])
                if file_hash(backup) != e['before_sha256']:
                    raise Refused('Original backup is damaged; restore refused')
            elif e['before_sha256'] is not None:
                raise Refused('Missing original backup')
            if current == e['after_sha256']:
                if stat.S_IMODE(target.stat().st_mode) != e['mode']:
                    raise Refused('Installed mode changed outside the installer')
                meta = e['old_metadata']
                if meta and (target.stat().st_uid != meta['uid'] or target.stat().st_gid != meta['gid']):
                    raise Refused('Owner changed; host restore cannot silently change ownership')
        journal['status'] = 'restoring'
        save_json(folder / 'journal.json', journal)
        for i, e in enumerate(reversed(entries)):
            target = checked_path(self.root, e['path'])
            scratch = checked_path(self.root, e['scratch'])
            if scratch.exists():
                scratch.unlink()
                fsync_dir(scratch.parent)
            if file_hash(target) == e['before_sha256']:
                continue
            if e['before_sha256'] is None:
                target.unlink()
                fsync_dir(target.parent)
            else:
                meta = e['old_metadata']
                if target.stat().st_uid != meta['uid'] or target.stat().st_gid != meta['gid']:
                    raise Refused('Owner changed; host-only restore will not silently change ownership')
                self._replace(target, read_regular(folder / e['backup']), meta['mode'], e['scratch'], meta['mtime_ns'],
                              fault_point='before-restore:%d' % (i + 1))
            fault('after-restore:%d' % (i + 1))
            if file_hash(target) != e['before_sha256']:
                raise Refused('Restored file verification failed')
        for value in sorted(journal['created_dirs'], key=lambda s: len(PurePosixPath(s).parts), reverse=True):
            if not str(relative(value)).startswith('jci/gui/'):
                raise Refused('Invalid created-directory entry')
            p = checked_path(self.root, value)
            if p.exists():
                try:
                    p.rmdir()
                    fsync_dir(p.parent)
                except OSError:
                    if not p.is_dir():
                        raise Refused('Created directory was replaced')
                    # Preserve unrelated new content; never recursively delete it.
        journal['status'] = 'restored'
        save_json(folder / 'journal.json', journal)
        return {'action': 'restored', 'transaction': journal['id'], 'files': len(entries)}

    def restore(self, tx):
        with self.locked():
            folder, path = self._journal(tx)
            journal = load_json(path)
            if journal['status'] == 'restored':
                return {'action': 'already-restored', 'transaction': tx}
            if journal['status'] not in ('prepared', 'installing', 'installed', 'restoring'):
                raise Refused('Unsupported transaction state')
            return self._restore(journal, folder)

    def verify(self):
        with self.locked():
            baseline = load_json(self.folder / 'baseline.json')
            current = inventory(self.root)
            changed = sorted(k for k in set(baseline) | set(current) if baseline.get(k) != current.get(k))
            return {'baseline_files': len(baseline), 'current_files': len(current), 'changed': changed,
                    'matches_baseline': not changed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    copy = sub.add_parser('copy')
    copy.add_argument('--source', required=True)
    copy.add_argument('--lab', required=True)
    for name in ('plan', 'apply', 'restore', 'recover', 'status', 'verify'):
        cmd = sub.add_parser(name)
        cmd.add_argument('--lab', required=True)
        if name in ('plan', 'apply'):
            cmd.add_argument('--module', required=True)
        if name in ('restore', 'recover'):
            cmd.add_argument('--transaction', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'copy':
            result = init_copy(args.source, args.lab)
        else:
            lab = Lab(args.lab)
            if args.command in ('plan', 'apply'):
                result = getattr(lab, args.command)(args.module)
            elif args.command in ('restore', 'recover'):
                result = lab.restore(args.transaction)
            elif args.command == 'verify':
                result = lab.verify()
            else:
                with lab.locked():
                    result = {'transactions': lab.journals()}
        print(json.dumps(result, ensure_ascii=True, indent=2))
    except (Refused, OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({'error': str(error), 'live_cmu_written': False}), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
