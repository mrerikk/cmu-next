#!/bin/sh
# Temporary action service only. No persistent installation or startup integration.
set -eu
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$(id -u)" = 0 ] || { echo 'stop: root terminal required';exit 2; }
base=$(CDPATH= cd -P "$(dirname "$0")" && pwd)
usb=$(CDPATH= cd -P "$base/.." && pwd)
case "$usb" in /tmp/mnt/sd[a-d]1) ;; *) echo 'stop: mounted USB package required';exit 2;; esac
awk -v p="$usb" -v d="/dev/${usb##*/}" '$2==p{n++;if($1!=d||$3!="vfat")bad=1}END{exit n!=1||bad}' /proc/mounts
fs=$(awk '$2=="/tmp"{n++;fs=$3}END{if(n!=1)exit 1;print fs}' /proc/mounts)
case "$fs" in tmpfs|ramfs) ;; *) echo 'stop: memory-backed /tmp required';exit 2;; esac
[ ! -e /tmp/cmu-next-control ] && [ ! -L /tmp/cmu-next-control ] || { echo 'stop: manager session already exists; reboot clears the temporary session';exit 2; }
work=$(mktemp -d /tmp/cmu-manager.XXXXXX)
printf 'cmu-manager-ram-01\n' > "$work/marker"
cp "$base/cmu-io" "$work/cmu-io"
[ "$(md5sum "$work/cmu-io" | awk '{print $1}')" = '@@io-md5@@' ] || exit 2
chmod 700 "$work/cmu-io";io=$work/cmu-io
"$io" check "$io" '@@io-sha@@'
for name in engine.sh dispatch.sh cmu-manager prepare-usb.sh; do cp "$base/$name" "$work/$name";done
"$io" check "$work/engine.sh" '@@engine-sha@@'
"$io" check "$work/dispatch.sh" '@@dispatch-sha@@'
"$io" check "$work/cmu-manager" '@@server-sha@@'
"$io" check "$work/prepare-usb.sh" '@@prepare-sha@@'
chmod 700 "$work/cmu-manager"
mkdir -p "$work/lab/rootfs" "$work/lab/native-state/transactions"
printf 'cmu-native-lab-02\n' > "$work/lab/native-lab.txt"
copy_input(){
 rel=$1;hash=$2
 "$io" check "/$rel" "$hash"
 mkdir -p "$work/lab/rootfs/${rel%/*}"
 cp -p "/$rel" "$work/lab/rootfs/$rel"
 "$io" check "$work/lab/rootfs/$rel" "$hash"
 [ "$("$io" metadata "/$rel")" = "$("$io" metadata "$work/lab/rootfs/$rel")" ]
}
copy_input jci/version.ini '@@version-sha@@'
copy_input jci/gui/index.html '@@index-sha@@'
copy_input jci/gui/common/images/background.png '@@background-sha@@'
copy_input jci/gui/common/css/common.css '@@css-sha@@'
{ echo 'startup-copy-inputs=verified';echo 'temporary-backing-filesystem=tmpfs-or-ramfs';uname -a;cat /proc/self/mountinfo; } > "$work/startup.txt"
"$work/cmu-manager" "$work" "$base" 9970 > "$work/service.log" 2>&1 &
pid=$!
printf '%s\n' "$pid" > "$work/service.pid"
i=0
while [ ! -f "$work/client.js" ] && [ "$i" -lt 5 ]; do sleep 1;i=$((i+1));done
[ -f "$work/client.js" ] && kill -0 "$pid" || { echo "stop: service failed; see $work/service.log";exit 2; }
mkdir /tmp/cmu-next-control
cp "$work/client.js" /tmp/cmu-next-control/client.js
printf '%s\n' "$work" > /tmp/cmu-next-control/work-path.txt
echo 'manager ready: temporary RAM copy only; lifetime 15 minutes'
echo 'exit the terminal and return to the USB player to open cmu next'
echo "session files: $work"
