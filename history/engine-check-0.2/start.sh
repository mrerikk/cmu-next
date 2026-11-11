#!/bin/sh
# Verified executables in RAM; only the known USB partition may be remounted for the report.
set -u
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
base=$(CDPATH= cd -P "$(dirname "$0")" && pwd) || exit 2
usb=$(CDPATH= cd -P "$base/.." && pwd) || exit 2
case "$usb" in /tmp/mnt/sd[a-d]1) ;; *) echo 'stop: package must be on a mounted usb partition'; exit 2;; esac
[ "$(id -u)" = 0 ] || { echo 'stop: use the existing cmu root terminal'; exit 2; }
name=${usb##*/}
awk -v p="$usb" -v d="/dev/$name" '$1==d&&$2==p&&$3=="vfat"{n++}END{exit n!=1}' /proc/mounts || exit 2
work=$(mktemp -d /tmp/cmu-engine-check.XXXXXX) || exit 2
printf 'cmu-engine-check-02\n' > "$work/marker" || exit 2
cp "$base/check.sh" "$work/check.sh" || exit 2
cp "$base/prepare-usb.sh" "$work/prepare-usb.sh" || exit 2
prepare_ok=no
[ "$(md5sum "$work/prepare-usb.sh" | awk '{print $1}')" = '772f96e91178307b1c1e58777a6ccccb' ] && prepare_ok=yes
if [ "$(md5sum "$work/check.sh" | awk '{print $1}')" = '87966e1001847bb921f55ced40a184a6' ]; then
 sh "$work/check.sh" "$work" "$base" > "$work/report.txt" 2>&1
 result=$?
else
 printf 'cmu-engine-check=0.2\nstarter-error=worker transport checksum mismatch\n' > "$work/report.txt"
 result=2
fi
printf 'worker-exit=%s\n' "$result" >> "$work/report.txt"
echo "check exit: $result"
echo "temporary report: $work/report.txt"
if [ "$prepare_ok" = yes ]; then sh "$work/prepare-usb.sh" "$usb"; fi
if awk -v p="$usb" '$2==p&&$4~/(^|,)rw(,|$)/{ok=1}END{exit !ok}' /proc/mounts; then
 n=1
 while [ "$n" -le 999 ]; do
  target=$usb/cmu-engine-report-$n
  if mkdir "$target" 2>/dev/null; then
   if cp "$work/report.txt" "$target/report.txt.part" && mv "$target/report.txt.part" "$target/report.txt"; then
    sync;echo "saved: $target/report.txt";exit "$result"
   fi
   break
  fi
  n=$((n+1))
 done
fi
echo 'usb save failed; report is still in temporary memory until reboot'
exit 1
