"""Build and publish the explicitly selected release batch. Requires GitHub CLI.

Never replaces existing assets: differing bytes require a new release version.
Run by the versioned-releases workflow with its repository-scoped job token.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/releases'
REPO = 'mrerikk/cmu-next'
PLAN = json.loads((ROOT / '.github/release-plan.json').read_text())
DATE = PLAN['date']
COMMIT = os.environ.get('GITHUB_SHA') or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
BASE = 'https://github.com/' + REPO
GRANT = BASE + '/blob/' + COMMIT + '/docs/licensing.md'
SOURCE_NAME = 'cmu-next-gpl-source-' + DATE + '.zip'
EPOCH = (2026, 11, 12, 0, 0, 0)


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def archive(name, entries):
    path = OUT / name
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel, data in sorted(entries.items()):
            assert rel == rel.lower() and '..' not in PurePosixPath(rel).parts
            assert not rel.endswith('index.html'), rel
            item = zipfile.ZipInfo(name[:-4] + '/' + rel, EPOCH)
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = 0o100644 << 16
            z.writestr(item, data)
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
    return path


def tracked_source(ref=None):
    if ref:
        data = subprocess.check_output(['git', 'archive', '--format=zip', ref], cwd=ROOT)
        import io
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            entries = {n: z.read(n) for n in z.namelist() if not n.endswith('/')}
    else:
        names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
        entries = {n: (ROOT / n).read_bytes() for n in names if n and (ROOT / n).is_file()}
    # A dated GPL reissue, with current notices and the project-authored carrier.
    for rel in ['license.md', 'notice.md', 'docs/licensing.md', 'docs/third-party.md',
                'src/loaders/readme.md', 'tools/build-loaders.py', 'requirements-loader.txt',
                'assets/audio/silence.mp3', 'assets/audio/provenance.json']:
        entries[rel] = (ROOT / rel).read_bytes()
    for p in (ROOT / 'src/loaders').glob('*.mp3'):
        entries[str(p.relative_to(ROOT))] = p.read_bytes()
    for p in (ROOT / 'design/sources').glob('*'):
        if p.is_file():
            entries[str(p.relative_to(ROOT))] = p.read_bytes()
    if ref:
        entries['readme.md'] = ('# Historical source — GPL reissue\n\nReissued on ' + DATE +
            ' from source commit ' + ref + '. This does not backdate the GPL grant or change original Git history. '
            'Our loader 1.0.0 replaces the superseded legacy carrier. Earlier licensing statements in historical documents are superseded by notice.md and docs/licensing.md.\n\n').encode() + entries['readme.md']
    return entries


def notices():
    entries = {n: (ROOT / n).read_bytes() for n in ['license.md', 'notice.md']}
    for p in (ROOT / 'notices').rglob('*'):
        if p.is_file():
            entries[str(p.relative_to(ROOT))] = p.read_bytes()
    entries['licensing.md'] = (ROOT / 'docs/licensing.md').read_bytes()
    entries['third-party.md'] = (ROOT / 'docs/third-party.md').read_bytes()
    return entries


def gh(*args):
    return run('gh', *args)


def publish(tag, title, notes, assets):
    note = OUT / (tag + '.md')
    note.write_text(notes + '\n\nSource commit: `' + COMMIT + '`. GPL grant effective ' + DATE + '. Third-party licenses remain unchanged.\n')
    found = subprocess.run(['gh', 'release', 'view', tag, '--repo', REPO, '--json', 'assets'], cwd=ROOT, capture_output=True, text=True)
    if found.returncode == 0:
        existing = {a['name']: a for a in json.loads(found.stdout)['assets']}
        for p in assets:
            if p.name in existing:
                # GitHub release asset digest is checked using the REST API below.
                release = json.loads(gh('api', 'repos/' + REPO + '/releases/tags/' + tag))
                a = next(a for a in release['assets'] if a['name'] == p.name)
                if a.get('digest') != 'sha256:' + digest(p):
                    raise RuntimeError('Refusing to replace a different existing asset: ' + tag + '/' + p.name)
        gh('release', 'edit', tag, '--repo', REPO, '--title', title, '--notes-file', str(note), '--prerelease')
        missing = [str(p) for p in assets if p.name not in existing]
        if missing:
            gh('release', 'upload', tag, *missing, '--repo', REPO)
    else:
        gh('release', 'create', tag, '--repo', REPO, '--title', title, '--notes-file', str(note), '--target', COMMIT, '--prerelease', *map(str, assets))
    release = json.loads(gh('api', 'repos/' + REPO + '/releases/tags/' + tag))
    by_name = {a['name']: a for a in release['assets']}
    for p in assets:
        a = by_name[p.name]
        assert a['size'] == p.stat().st_size and a.get('digest') == 'sha256:' + digest(p), p.name
    record.append({'tag': tag, 'url': release['html_url'], 'assets': {p.name: digest(p) for p in assets}})
    (OUT / 'publication.json').write_text(json.dumps(record, indent=2) + '\n')
    print('Verified release:', release['html_url'], flush=True)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=False)
    record = []
    if PLAN['batch'] == 'ssh-tools-0.2':
        source = archive('cmu-next-source-ssh-tools-0.2-gpl.zip', tracked_source())
        entries = notices()
        entries['start-ssh.sh'] = (ROOT / 'src/ssh/start-ssh.sh').read_bytes()
        entries['readme.md'] = (ROOT / 'docs/ssh-testing.md').read_bytes()
        helper = archive('cmu-ssh-service-0.1-usb.zip', entries)
        sums = OUT / 'sha256sums.txt'
        sums.write_text(''.join(digest(p) + '  ' + p.name + '\n' for p in [source, helper]))
        notes = ('## Changes\n- Add a device-side check/start helper for the existing stock OpenSSH daemon. Copy start-ssh.sh to the USB root and invoke it from the working CMU root terminal.\n- Document public historical cmu/jci defaults, their firmware limits and a request to change the password after first successful login.\n- Require an explicit SSH port; the inspected firmware copy uses 36000, with password authentication disabled.\n- Add an explicit authenticated laptop command to start the prepared USB manager.\n\n## Downloads\nThe helper USB ZIP contains start-ssh.sh and notices. The source ZIP contains the laptop tools, complete corresponding source, tests and English instructions under docs/ssh-testing.md. SHA-256 checksums are attached.\n\n## Validation and limits\nFifteen offline SSH checks pass. No native SSH login has been verified. The helper preserves existing accounts, keys, SSH policy, firewall and boot configuration; it does not reset passwords or bypass disabled authentication. No project fifteen-minute timer applies to the stock daemon. The manager still needs its own complete USB package and native validation. Testing targets Mazda Roadster ND 2016 Japan with 74.00.324A EU only; other Connect 1 cars are untested.')
        publish('ssh-tools-0.2', 'SSH tools 0.2 — stock-service helper and manager bootstrap', notes, [source, helper, sums])
        raise SystemExit(0)
    current = archive(SOURCE_NAME, tracked_source())
    archive('cmu-next-source-snapshot-2026-11-11-gpl.zip', tracked_source('f0710e27793ef38fbf667f57ef566a9db9ea2996'))
    archive('cmu-next-source-loader-1.0.0-gpl.zip', tracked_source('655d3b87bfee820b2298631bdd6666b73508710f'))
    loader_entries = notices()
    loader_entries['readme.md'] = (ROOT / 'src/loaders/readme.md').read_bytes()
    for p in (ROOT / 'src/loaders').glob('*.mp3'):
        loader_entries['mp3/' + p.name] = p.read_bytes()
    loader = archive('cmu-loader-1.0.0-gpl.zip', loader_entries)
    packages = {}
    for version in PLAN['retrofit']:
        built = OUT / ('built-' + version)
        run('python3', 'tools/build-retrofit.py', '--version', version, '--out', str(built))
        entries = notices()
        entries.update({str(p.relative_to(built)): p.read_bytes() for p in built.rglob('*') if p.is_file()})
        entries['readme.md'] = ('# Temporary retrofit ' + version + ' — GPL reissue\n\nCopy the contents of usb to the flash-drive root. Use the MP3 for the actual USB mount. Do not merge manager and visual js/run.js files. The visual overlay lasts 10 minutes and is not a permanent installer.\n\nHistorical visual runtime; packaged on ' + DATE + ' with own loader 1.0.0. New MP3 bytes require a CMU run. Vehicle testing targets Mazda Roadster ND 2016 Japan, CMU 74.00.324A EU only; other Connect 1 vehicles are untested.\n\nCorresponding source: ' + BASE + '/releases/download/' + PLAN['batch'] + '/' + SOURCE_NAME + '\n\nLicense grant: ' + GRANT + '\n').encode()
        packages[version] = archive('cmu-retrofit-' + version + '-gpl-usb.zip', entries)
    archives = sorted(OUT.glob('*.zip'))
    sums = OUT / 'sha256sums.txt'
    sums.write_text(''.join(digest(p) + '  ' + p.name + '\n' for p in archives))
    notes = ('## GPL reissue and versioned downloads\nProject-authored material, including all earlier project versions and commits, is GPL-3.0-or-later under the grant effective ' + DATE + '. Commercial use is permitted under GPL. Original publication history is preserved.\n\n'
        '## Assets\n- Current source archive: code, build tools, editable graphics, English documentation and validation evidence.\n- Four complete temporary retrofit USB packages: 0.6.2, 0.7, 0.7.1 and 0.8. Copy the contents of usb to the flash-drive root.\n- Own MP3 loader 1.0.0 and two historical source reissues.\n- SHA-256 checksums for every ZIP.\n\n'
        '## Validation\nSource checks, loader reconstruction and host tests passed before publication. Historical visual runtimes are reconstructed against preserved SHA-256 digests. Each uploaded asset is verified against GitHub’s SHA-256 digest.\n\n'
        '## Limits\nOwn MP3 bytes still need a CMU run. Visual overlays last 10 minutes; no permanent installation. Manager 0.3.1/0.3.2 had native startup failures; 0.3.3/0.3.4 remain candidates. Testing targets Mazda Roadster ND 2016 Japan, CMU 74.00.324A EU. Other Connect 1 cars are untested. OEM firmware/index and private reports are excluded. Do not merge manager and visual loaders.\n\n[Licensing grant](' + GRANT + ') · [Release policy](' + BASE + '/blob/' + COMMIT + '/docs/releases.md)')
    publish(PLAN['batch'], 'GPL reissue — source and temporary USB packages', notes, archives + [sums])
    descriptions = {
        '0.6.2': 'Preserves the accepted beveled, glowing row-selection baseline.',
        '0.7': 'Preserves the next Connect 2-inspired visual milestone; also the basis of the separate browser design study.',
        '0.7.1': 'Preserves the intermediate visual refinement milestone between 0.7 and 0.8.',
        '0.8': 'Adds equipment-driven settings categories while retaining the shared selection and arc/scroll treatment.'}
    for version, package in packages.items():
        subset = OUT / ('retrofit-' + version + '-sha256sums.txt')
        subset.write_text(''.join(digest(p) + '  ' + p.name + '\n' for p in [package, current]))
        notes = ('## Historical visual milestone\n' + descriptions[version] + '\n\nPublished as a dated GPL reissue, not a claim of a newly completed hardware test.\n\n'
            '## Download\nThe USB ZIP contains the complete temporary visual package, notices and own MP3 loader 1.0.0. Copy the contents of usb to the flash-drive root. The source ZIP includes this version under history/retrofit/' + version + ' and tools/build-retrofit.py to reconstruct its hash-checked runtime. Checksums are attached.\n\n'
            '## Test status\nHistorical visual iteration; the repackaged own MP3 bytes still require a CMU run. Ten-minute temporary overlay, not a permanent installer. Testing targets Mazda Roadster ND 2016 Japan with 74.00.324A EU only. Other Connect 1 vehicles are untested. Do not merge this js/run.js with a manager loader.')
        publish('retrofit-' + version, 'Retrofit ' + version + ' — temporary visual milestone (GPL reissue)', notes, [package, current, subset])
    candidates = {
        'manager-0.3.3': ('Manager 0.3.3 — forked-launch candidate', 'Introduces fork-before-setsid launch and actual service PID publication after the earlier native startup failures.', '58c0f4fdfc75ef6fa64051baf6cc410d1c71980f'),
        'manager-0.3.4': ('Manager 0.3.4 — transaction-publication candidate', 'Adds staged publication of complete prepared transaction journals and versioned reports. Host regression tests pass; native CMU validation is pending.', '4b321f0289a1f9319f1df954ce165f5b9569a35a'),
        'ssh-tools-0.1.1': ('SSH tools 0.1.1 — connection-preparation candidate', 'Provides private OpenSSH configuration, probes, read-only observations and loopback forwarding. Offline checks pass; an actual vehicle connection is unverified.', None),
        'apps-runtime-0.1': ('Application lifecycle core 0.1 — host-only foundation', 'Adds application registration and teardown, resource disposal, input routing and speed-data validity checks. No native bridge, app installation, vehicle telemetry source or working speedometer exists yet.', None)}
    for tag in PLAN['source_candidates']:
        title, description, historical_commit = candidates[tag]
        source = current
        if historical_commit:
            source = archive('cmu-next-source-' + tag + '-gpl.zip', tracked_source(historical_commit))
        subset = OUT / (tag + '-sha256sums.txt')
        subset.write_text(digest(source) + '  ' + source.name + '\n')
        notes = ('## Scope\n' + description + '\n\n## Downloads and status\nSource-only engineering prerelease, with SHA-256 checksum. Build instructions and known limitations are included. A public ready-to-run manager USB bundle is not attached because local test bundles require a separately supplied, hash-verified OEM index. No permanent installer or broad vehicle compatibility is claimed.\n\nTesting targets Mazda Roadster ND 2016 Japan with CMU 74.00.324A EU; other Connect 1 cars are untested. ' + ('Source milestone: `' + historical_commit + '`; GPL notices and own loader are refreshed in this reissue.' if historical_commit else 'The attached project source includes this component and its host tests.'))
        publish(tag, title, notes, [source, subset])
    for tag in ['snapshot-2026-11-11', 'loader-1.0.0']:
        release = json.loads(gh('api', 'repos/' + REPO + '/releases/tags/' + tag))
        body = release['body'] or ''
        marker = '<!-- gpl-reissue-notice -->'
        if marker not in body:
            body = marker + '\n## Superseded downloads — GPL grant update\nProject-authored material in this and all earlier versions is also available under GPL-3.0-or-later, effective ' + DATE + '. Commercial use is permitted under GPL. Third-party rights remain separate. Original publication dates and attachments are retained as historical records. Prefer the [GPL reissues with own-loader USB packages](' + BASE + '/releases/tag/' + PLAN['batch'] + ') and [component releases](' + BASE + '/releases). Older licensing statements below describe the original publication only and are superseded by the new grant. The original snapshot’s legacy audio carrier is excluded from that grant; use the own-loader reissues.\n\n---\n\n' + body
            note = OUT / (tag + '-updated.md')
            note.write_text(body)
            gh('release', 'edit', tag, '--repo', REPO, '--notes-file', str(note))
    print('Completed release batch:', PLAN['batch'])
