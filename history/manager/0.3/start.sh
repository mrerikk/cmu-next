#!/bin/sh
# USB entry: verified RAM service, initial copy once, resumable journal within this CMU boot.
set -eu
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
error(){ echo "stop: $*";exit 2; }
[ "$(id -u)" = 0 ] || error 'root terminal required'
base=$(CDPATH= cd -P "$(dirname "$0")" && pwd)
usb=$(CDPATH= cd -P "$base/.." && pwd)
case "$usb" in /tmp/mnt/sd[a-d]1) ;; *) error 'mounted USB package required';; esac
awk -v p="$usb" -v d="/dev/${usb##*/}" '$2==p{n++;if($1!=d||$3!="vfat")bad=1}END{exit n!=1||bad}' /proc/mounts || error 'USB identity'
fs=$(awk '$2=="/tmp"{n++;fs=$3}END{if(n!=1)exit 1;print fs}' /proc/mounts)
case "$fs" in tmpfs|ramfs) ;; *) error 'memory-backed /tmp required';; esac
control=/tmp/cmu-next-control
tmp=$(CDPATH= cd -P /tmp && pwd)
plain(){ [ ! -L "$1" ] && [ -f "$1" ] && [ "$(stat -c '%h' "$1")" = 1 ]; }
if [ -e "$control" ] || [ -L "$control" ]; then
 [ ! -L "$control" ] && [ -d "$control" ] || error 'control path type'
 [ "$(stat -c '%a %u %g' "$control")" = "700 $(id -u) $(id -g)" ] || error 'control permissions'
 plain "$control/marker" && [ "$(cat "$control/marker")" = cmu-manager-control-03 ] || error 'different session version; reboot CMU to clear RAM'
 for name in work-path.txt client.js client.next;do
  if [ -e "$control/$name" ] || [ -L "$control/$name" ];then plain "$control/$name" || error 'control file type';fi
 done
 plain "$control/work-path.txt" || error 'work pointer type'
 work=$(cat "$control/work-path.txt")
 case "$work" in *[!a-zA-Z0-9_./-]*) error 'work pointer characters';; esac
 [ "${work%/*}" = "$tmp" ] || error 'work pointer parent'
 case "${work##*/}" in cmu-manager.*) ;; *) error 'work pointer name';; esac
 [ ! -L "$work" ] && [ -d "$work" ] && [ "$(CDPATH= cd -P "$work" && pwd)" = "$work" ] || error 'work pointer canonical identity'
 fresh=no
else
 read -r uptime idle < /proc/uptime
 stamp=$(printf '%s' "$uptime" | tr -d '.')
 case "$stamp" in ''|*[!0-9]*) error 'temporary session identifier';; esac
 work=/tmp/cmu-manager.$$.$stamp
 mkdir -m 700 "$work" || error 'exclusive private workspace'
 work=$(CDPATH= cd -P "$work" && pwd)
 chown "$(id -u):$(id -g)" "$work";chmod 700 "$work"
 printf 'cmu-manager-ram-01\n' > "$work/marker"
 printf 'cmu-manager-bootstrap-03\n' > "$work/bootstrap-version"
 printf '%s\n' "$base" > "$work/package-path"
 fresh=yes
fi
echo "manager workspace: $work"
[ "$(stat -c '%a %u %g' "$work")" = "700 $(id -u) $(id -g)" ] || error 'private workspace permissions'
plain "$work/marker" && [ "$(cat "$work/marker")" = cmu-manager-ram-01 ] || error 'workspace marker'
plain "$work/bootstrap-version" && [ "$(cat "$work/bootstrap-version")" = cmu-manager-bootstrap-03 ] || error 'workspace version'
plain "$work/package-path" && [ "$(cat "$work/package-path")" = "$base" ] || error 'workspace belongs to different USB path'
for name in bootstrap.lock service.lock service.pid service.log auth client.js client.next;do
 if [ -e "$work/$name" ] || [ -L "$work/$name" ];then plain "$work/$name" || error 'workspace writable file type';fi
done
if [ "$fresh" = yes ]; then cp "$base/cmu-io" "$work/cmu-io";fi
plain "$work/cmu-io" && [ "$(md5sum "$work/cmu-io" | awk '{print $1}')" = '@@io-md5@@' ] || error 'helper transport checksum'
chmod 700 "$work/cmu-io";io=$work/cmu-io
"$io" check "$io" '@@io-sha@@'
verify(){ name=$1;digest=$2;plain "$base/$name" || error 'USB component type';"$io" check "$base/$name" "$digest";if [ "$fresh" = yes ];then cp "$base/$name" "$work/$name";fi;plain "$work/$name" || error 'RAM component type';"$io" check "$work/$name" "$digest"; }
verify engine.sh '@@engine-sha@@'
verify dispatch.sh '@@dispatch-sha@@'
verify cmu-manager '@@server-sha@@'
verify cmu-jobs '@@jobs-sha@@'
verify prepare-usb.sh '@@prepare-sha@@'
verify session.sh '@@session-sha@@'
chmod 700 "$work/cmu-manager" "$work/cmu-jobs"
copy_input(){
 rel=$1;hash=$2
 "$io" check "/$rel" "$hash"
 if [ "$fresh" = yes ];then
  mkdir -p "$work/lab/rootfs/${rel%/*}"
  cp -p "/$rel" "$work/lab/rootfs/$rel"
  "$io" check "$work/lab/rootfs/$rel" "$hash"
  [ "$("$io" metadata "/$rel")" = "$("$io" metadata "$work/lab/rootfs/$rel")" ] || error 'input metadata'
 fi
}
if [ "$fresh" = yes ];then mkdir -p "$work/lab/rootfs" "$work/lab/native-state/transactions";printf 'cmu-native-lab-02\n' > "$work/lab/native-lab.txt";fi
plain "$work/lab/native-lab.txt" && [ "$(cat "$work/lab/native-lab.txt")" = cmu-native-lab-02 ] || error 'lab marker'
copy_input jci/version.ini '@@version-sha@@'
copy_input jci/gui/index.html '@@index-sha@@'
copy_input jci/gui/common/images/background.png '@@background-sha@@'
copy_input jci/gui/common/css/common.css '@@css-sha@@'
if [ "$fresh" = yes ];then
 { echo 'startup-copy-inputs=verified';echo 'bootstrap-version=0.3';echo 'temporary-backing-filesystem=tmpfs-or-ramfs';uname -a;cat /proc/self/mountinfo; } > "$work/startup.txt"
fi
exec "$io" lock-run "$work/bootstrap.lock" /bin/sh "$work/session.sh" "$work" "$base" "$control"
