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
awk -v p="$usb" -v d="/dev/$name" '$2==p{n++;if($1!=d||$3!="vfat")bad=1}END{exit n!=1||bad}' /proc/mounts || exit 2
temporary_fs=$(awk '$2=="/tmp"{n++;fs=$3}END{if(n!=1)exit 1;print fs}' /proc/mounts) || exit 2
case "$temporary_fs" in tmpfs|ramfs) ;; *) echo 'stop: /tmp must be memory-backed'; exit 2;; esac
work=$(mktemp -d /tmp/cmu-live-preflight.XXXXXX) || exit 2
printf 'cmu-live-preflight-02\n' > "$work/marker" || exit 2
cp "$base/collect.sh" "$work/collect.sh" || exit 2
cp "$base/prepare-usb.sh" "$work/prepare-usb.sh" || exit 2
prepare_ok=no
[ "$(md5sum "$work/prepare-usb.sh" | awk '{print $1}')" = '772f96e91178307b1c1e58777a6ccccb' ] && prepare_ok=yes
if [ "$(md5sum "$work/collect.sh" | awk '{print $1}')" = '5ee02e3cc7c63760bd65d288e24b2b85' ]; then
 sh "$work/collect.sh" "$work" "$base" > "$work/report.txt" 2>&1
 result=$?
else
 printf 'cmu-live-preflight=0.2\nstarter-error=worker transport checksum mismatch\n' > "$work/report.txt"
 result=2
fi
printf 'worker-exit=%s\n' "$result" >> "$work/report.txt"
echo "preflight exit: $result"
echo "temporary report: $work/report.txt"
if [ "$prepare_ok" = yes ]; then sh "$work/prepare-usb.sh" "$usb"; fi
if awk -v p="$usb" '$2==p&&$4~/(^|,)rw(,|$)/{ok=1}END{exit !ok}' /proc/mounts; then
 n=1
 while [ "$n" -le 999 ]; do
  target=$usb/cmu-preflight-report-$n
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
