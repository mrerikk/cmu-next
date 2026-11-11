#!/bin/sh
# Capability report. Only the caller-created temporary directory is writable.
set -u
[ "$#" -eq 1 ] || exit 2
work=$1
case "$work" in /tmp/cmu-probe.*) ;; *) echo 'refused: temporary path required'; exit 2;; esac
[ -d "$work" ] && [ ! -L "$work" ] || exit 2
[ "$(cat "$work/marker" 2>/dev/null)" = cmu-probe-01 ] || exit 2
printf '%s\n' 'cmu-probe=0.1' 'scope=information and temporary-file tests only'
printf '\nidentity:\n'; id
printf '\nversion:\n'; cat /jci/version.ini 2>/dev/null
printf '\nkernel:\n'; uname -a
printf '\ncommands:\n'
for name in busybox md5sum sha256sum openssl tar gzip stat readlink mv cp chmod chown touch sync flock fsync df du awk sed grep cmp mktemp python python3 perl; do
 command -v "$name" 2>/dev/null || printf '%s: unavailable\n' "$name"
done
printf '\nbusybox applets:\n'
busybox --list 2>&1
printf '\nmounts:\n'; cat /proc/mounts 2>/dev/null
printf '\nmountinfo:\n'; cat /proc/self/mountinfo 2>/dev/null
printf '\nspace:\n'; df -k / /jci /data /data_persist /resources /tmp 2>&1
printf '\nselected directory metadata:\n'
for path in / /jci /jci/gui/common/images /data /data_persist /resources /tmp; do
 ls -ldn "$path" 2>&1
 readlink "$path" 2>/dev/null || :
done
printf '\nutility help:\n'
for name in sync stat tar mv cp; do
 printf '\n%s:\n' "$name"
 "$name" --help 2>&1
 done
printf '\ntemporary operations:\n'
printf 'cmu-old\n' > "$work/current" || exit 2
cp -p "$work/current" "$work/copy" && echo 'copy-preserve=pass'
chmod 640 "$work/copy" && echo 'chmod=pass'
stat -c '%a %u %g %s %Y' "$work/copy" 2>&1
# Exercise timestamps and numeric owners using only the temporary copy.
touch -t 200101010101 "$work/copy" && echo 'touch-time=pass'
chown 0:0 "$work/copy" && echo 'chown-root=pass'
stat -c '%a %u %g %s %Y' "$work/copy" 2>&1
if (cd "$work" && tar -cf backup.tar copy && mkdir restored && cd restored && tar -xpf ../backup.tar); then
 echo 'tar-roundtrip=pass'
 stat -c '%a %u %g %s %Y' "$work/restored/copy" 2>&1
 cmp "$work/copy" "$work/restored/copy" && echo 'tar-content=pass'
fi
printf 'cmu-new\n' > "$work/stage"
if mv -f "$work/stage" "$work/current" && [ "$(cat "$work/current")" = cmu-new ] && [ ! -e "$work/stage" ]; then
 echo 'rename-replacement=pass'
fi
md5sum "$work/current" 2>&1
# Test supported flush syntax on our own temporary data; success does not prove power-loss durability.
if sync -f "$work/current" 2>/dev/null; then echo 'sync-file-option=available'; else echo 'sync-file-option=unavailable'; fi
sync && echo 'global-sync=pass'
printf '\nreport-complete=yes\n'
