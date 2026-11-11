#!/bin/sh
# Bounded persistent-store capability probe. No OEM writes, remounts or startup changes.
# This template must be pinned to an inspected preflight 0.2 plan before native use.
set -eu
set -f
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$#" -eq 4 ] || exit 2
work=$1;plan=$2;action=$3;token=$4
error(){ echo "stop: $*";exit 2; }
[ ! -L "$work" ] || error 'RAM work symlink'
work=$(CDPATH= cd -P "$work" && pwd)
tmp=$(CDPATH= cd -P /tmp && pwd)
[ "${work%/*}" = "$tmp" ] || error 'private RAM workspace required'
case "${work##*/}" in cmu-storage-probe.*) ;; *) error 'RAM work name';; esac
[ "$(cat "$work/marker")" = cmu-storage-probe-01 ] || error 'RAM work marker'
[ "$(id -u)" = 0 ] || error 'root terminal required'
[ "$(stat -c '%a %u %g' "$work")" = "700 $(id -u) $(id -g)" ] || error 'RAM workspace ownership or permissions'
mem=$(awk -v p="$work" '$2=="/"||p==$2||index(p,$2"/")==1{if(length($2)>n){n=length($2);f=$3;c=1}else if(length($2)==n)c++}END{if(c!=1)exit 1;print f}' /proc/mounts)
case "$mem" in tmpfs|ramfs) ;; *) error 'RAM backing required';; esac
io=$work/cmu-io
[ ! -L "$io" ] && [ -f "$io" ] || error 'helper type'
[ "$(md5sum "$io" | awk '{print $1}')" = '@@io-md5@@' ] || error 'helper transport checksum'
[ "$("$io" version)" = 'cmu-io 0.2' ] || error 'helper version'
"$io" check "$io" '@@io-sha@@' >/dev/null
[ ! -L "$plan" ] && [ -f "$plan" ] || error 'plan type'
"$io" check "$plan" '@@plan-sha@@' >/dev/null
[ "$(wc -l < "$plan" | tr -d ' ')" = 5 ] || error 'plan shape'
[ "$(sed -n '1p' "$plan")" = cmu-storage-plan-v1 ] || error 'plan format'
root=$(sed -n '2s/^canonical //p' "$plan")
source=$(sed -n '3s/^source //p' "$plan")
[ "$(sed -n '4p' "$plan")" = 'filesystem relfs' ] || error 'plan filesystem'
report_hash=$(sed -n '5s/^preflight-sha256 //p' "$plan")
[ "${#report_hash}" = 64 ] || error 'preflight identity'
case "$report_hash" in *[!a-f0-9]*) error 'preflight hash';; esac
case "$root:$source" in /tmp/mnt/data_persist:/dev/mmcblk0p2|/tmp/mnt/data:/dev/ffx01p4) ;; *) error 'storage allowlist';; esac
# The candidate is already a physical canonical path: do not follow storage aliases or links.
rest=${root#/};path=
while [ -n "$rest" ]; do
 part=${rest%%/*};case "$rest" in */*) rest=${rest#*/};; *) rest=;; esac
 path=$path/$part;[ ! -L "$path" ] && [ -d "$path" ] || error 'storage path type'
done
[ "$(CDPATH= cd -P "$root" && pwd)" = "$root" ] || error 'storage canonical identity'
[ ! -e "$root/cmu-next" ] && [ ! -L "$root/cmu-next" ] || error 'existing application namespace'
# Reject stacked mounts, nested shadows and changes. No mount command is used by this worker.
mount_identity(){
 awk -v p="$root" -v dev="$source" '
  $2=="/"||p==$2||index(p,$2"/")==1{if(length($2)>n){n=length($2);row=$0;c=1}else if(length($2)==n)c++}
  END{if(c!=1)exit 1;split(row,a," ");if(a[1]!=dev||a[2]!=p||a[3]!="relfs"||a[4]!~/(^|,)rw(,|$)/||a[4]~/(^|,)ro(,|$)/)exit 1;print row}' /proc/mounts
}
mount_before=$(mount_identity) || error 'storage mount identity'
cat /proc/self/mountinfo > "$work/mountinfo-before"
mountinfo_before=$("$io" sha256 "$work/mountinfo-before")
awk -v p="$root" -v dev="$source" '
 $5=="/"||p==$5||index(p,$5"/")==1{if(length($5)>n){n=length($5);row=$0;c=1}else if(length($5)==n)c++}
 END{if(c!=1)exit 1;split(row,halves," - ");split(halves[1],a," ");split(halves[2],b," ");if(a[4]!="/"||a[5]!=p||a[6]!~/(^|,)rw(,|$)/||a[6]~/(^|,)ro(,|$)/||b[1]!="relfs"||b[2]!=dev||b[3]!~/(^|,)rw(,|$)/||b[3]~/(^|,)ro(,|$)/)exit 1}' "$work/mountinfo-before" || error 'storage mountinfo backing or bind root'
root_meta=$(stat -c '%a %u %g %d %i' "$root")
# Require room for the real future journal; this tiny probe itself writes under 64 KiB of file data.
free=$(df -k "$root" | awk -v p="$root" -v dev="$source" '$1==dev&&$NF==p{c++;if(NF!=6||$4!~/^[0-9]+$/)exit 1;n=$4}END{if(c!=1)exit 1;print n}')
[ "$free" -ge 8192 ] || error 'storage needs at least 8 MiB free'
bootid=$(cat /proc/sys/kernel/random/boot_id)
[ "${#bootid}" = 36 ] || error 'boot identity unavailable'
case "$bootid" in *[!a-f0-9-]*) error 'boot identity';; esac
case "$bootid" in ????????-????-????-????-????????????) ;; *) error 'boot identity groups';; esac
stock_root=
snapshot_stock(){
 while read -r expected rel; do
  current=$stock_root;rest=$rel
  while [ -n "$rest" ]; do
   part=${rest%%/*};case "$rest" in */*) rest=${rest#*/};; *) rest=;; esac
   current=$current/$part;[ ! -L "$current" ] || error 'stock path symlink'
   if [ -n "$rest" ]; then [ -d "$current" ] || error 'stock parent';else [ -f "$current" ] || error 'stock file';fi
  done
  "$io" check "$current" "$expected" >/dev/null
  printf '%s %s %s\n' "$rel" "$expected" "$("$io" metadata "$current")"
 done <<'STOCK'
7613d9b53aaf53bbc54a996737d38efe72bdf589f5839bb0d29622d6668dc340 jci/version.ini
b0e116b941f29078ced19b864a1b888cf76d8bc3e4974af081efca4693e5c420 jci/gui/index.html
807b79209e0540fa4d0b8fe76a32b87f9e229089ecc722f874476001f85353b6 jci/gui/common/images/background.png
807d2215bf76c94978ce1e8aeb0f268665b14a6d326e89836ef641c79a8cc4d1 jci/gui/common/css/common.css
2ec71fc955d0107a6e90d1ab4e6f00c9438b56d3e621ef018d57c8ef07bfae7f jci/scripts/stage_usb.sh
fa3484d7c644393ab6cb083990e483201129a207e7755459296dde8ec82a4d84 jci/sm/sm.conf
STOCK
}
snapshot_stock > "$work/stock-before"
version=$stock_root/jci/version.ini
version_sha=7613d9b53aaf53bbc54a996737d38efe72bdf589f5839bb0d29622d6668dc340
version_meta=$("$io" metadata "$version")
[ "$(wc -c < "$version" | tr -d ' ')" -le 16384 ] || error 'sample size bound'
printf 'cmu-next storage probe update\n' > "$work/update"
update_sha=$("$io" sha256 "$work/update")
plain(){ [ ! -L "$1" ] && [ -f "$1" ] && [ "$(stat -c '%h' "$1")" = 1 ]; }
if [ "$action" = prepare ]; then
 [ "$token" = - ] || error 'prepare token must be generated'
 # Do not stack probes or overwrite an incomplete one. No recursive removal is used.
 [ -z "$(find "$root" -mindepth 1 -maxdepth 1 -name 'cmu-next-storage.*' -print)" ] || error 'another probe exists'
 token=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
 [ "${#token}" = 32 ] || error 'random token'
 case "$token" in *[!a-f0-9]*) error 'random token format';; esac
 session=$root/cmu-next-storage.$token
 mkdir -m 700 "$session" || error 'exclusive probe directory'
 chown "$(id -u):$(id -g)" "$session";chmod 700 "$session"
 printf 'cmu-storage-probe-v1\n%s\n@@plan-sha@@\n' "$token" > "$session/marker"
 "$io" sync-file "$session/marker";"$io" sync-dir "$session";"$io" sync-dir "$root"
 exec "$io" lock-run "$session/lock" /bin/sh "$0" "$work" "$plan" locked-prepare "$token"
fi
[ "${#token}" = 32 ] || error 'token length'
case "$token" in *[!a-f0-9]*) error 'token format';; esac
session=$root/cmu-next-storage.$token
[ ! -L "$session" ] && [ -d "$session" ] || error 'probe directory type'
[ "$(stat -c '%a %u %g' "$session")" = "700 $(id -u) $(id -g)" ] || error 'probe directory ownership or permissions'
plain "$session/marker" || error 'probe marker type'
[ "$(cat "$session/marker")" = "$(printf 'cmu-storage-probe-v1\n%s\n@@plan-sha@@\n' "$token")" ] || error 'probe marker identity'
# Reject unknown files, nested objects, symlinks and hardlinks before any changes or cleanup.
find "$session" -mindepth 1 -maxdepth 1 -print > "$work/session-entries"
while IFS= read -r entry; do
 case "${entry##*/}" in marker|lock|payload|backup|baseline.sha|baseline.meta|phase|phase.next|publish.part|restore.part|boot-id) ;; *) error 'unexpected probe entry';; esac
 plain "$entry" || error 'probe entry type'
 size=$(wc -c < "$entry" | tr -d ' ')
 case "${entry##*/}" in
  payload|backup|restore.part) limit=16384;;
  publish.part|baseline.sha) limit=65;;
  phase|phase.next|boot-id) limit=64;;
  lock) limit=0;;
  *) limit=256;;
 esac
 [ "$size" -le "$limit" ] || error 'probe entry exceeds data bound'
done < "$work/session-entries"
case "$action" in
 resume|cleanup) exec "$io" lock-run "$session/lock" /bin/sh "$0" "$work" "$plan" "locked-$action" "$token";;
 locked-prepare|locked-resume|locked-cleanup) "$io" lock-check "$session/lock" >/dev/null || error 'probe lock not owned';;
 *) error 'unknown operation';;
esac
phase(){
 [ ! -e "$session/phase.next" ] && [ ! -L "$session/phase.next" ] || error 'stale phase staging'
 printf '%s\n' "$1" > "$session/phase.next"
 "$io" sync-file "$session/phase.next"
 mv "$session/phase.next" "$session/phase";"$io" sync-dir "$session"
}
fault(){ if [ "${CMU_STORAGE_LAB_FAULT:-}" = "$1" ]; then kill -KILL $$;fi; }
printf '%s\n' 'cmu-storage-probe=0.1' 'execution-context=cmu-native' 'oem-writes=none' 'mount-changes=none' 'live-installation=disabled'
printf 'effective-uid=%s\nnative-helper-sha256=@@io-sha@@\nfile-data-limit-bytes=65536\n' "$(id -u)"
echo 'kernel:';uname -a
printf 'operation=%s\nprobe-token=%s\nstorage-canonical=%s\nstorage-source=%s\nplan-sha256=@@plan-sha@@\n' "${action#locked-}" "$token" "$root" "$source"
case "$action" in
 locked-prepare)
  for entry in payload backup baseline.sha baseline.meta phase phase.next publish.part restore.part boot-id; do
   [ ! -e "$session/$entry" ] && [ ! -L "$session/$entry" ] || error 'prepare cannot overwrite files'
  done
  cp -p "$version" "$session/payload";cp -p "$session/payload" "$session/backup"
  [ "$("$io" sha256 "$session/backup")" = "$version_sha" ] && [ "$("$io" metadata "$session/backup")" = "$version_meta" ] || error 'backup identity or metadata'
  printf '%s\n' "$version_sha" > "$session/baseline.sha"
  printf '%s\n' "$version_meta" > "$session/baseline.meta"
  printf '%s\n' "$bootid" > "$session/boot-id"
  for file in payload backup baseline.sha baseline.meta boot-id; do "$io" sync-file "$session/$file";done
  "$io" sync-dir "$session";phase prepared;fault after-prepare
  "$io" stage "$work/update" "$session/publish.part" "$update_sha"
  mv "$session/publish.part" "$session/payload";"$io" sync-dir "$session";fault after-publish
  phase published
  printf 'prepared-boot-id=%s\nobserved-boot-id=%s\nboot-boundary-observed=no\n' "$bootid" "$bootid"
  echo 'probe-phase=published'
  echo 'next-operation=resume'
  ;;
 locked-resume|locked-cleanup)
  for file in payload backup baseline.sha baseline.meta phase boot-id; do plain "$session/$file" || error 'incomplete probe';done
  [ "$(cat "$session/baseline.sha")" = "$version_sha" ] && [ "$(cat "$session/baseline.meta")" = "$version_meta" ] || error 'baseline does not match read-only source'
  [ "$("$io" sha256 "$session/backup")" = "$version_sha" ] && [ "$("$io" metadata "$session/backup")" = "$version_meta" ] || error 'backup was modified'
  current_phase=$(cat "$session/phase")
  case "$current_phase" in prepared|published|recovered) ;; *) error 'probe phase';; esac
  current_sha=$("$io" sha256 "$session/payload")
  case "$current_sha" in "$version_sha"|"$update_sha") ;; *) error 'unknown payload content';; esac
  prepared_boot=$(cat "$session/boot-id")
  [ "${#prepared_boot}" = 36 ] || error 'prepared boot identity'
  case "$prepared_boot" in *[!a-f0-9-]*) error 'prepared boot identity';; esac
  case "$prepared_boot" in ????????-????-????-????-????????????) ;; *) error 'prepared boot groups';; esac
  printf 'prepared-boot-id=%s\nobserved-boot-id=%s\n' "$prepared_boot" "$bootid"
  if [ "$prepared_boot" = "$bootid" ]; then echo 'boot-boundary-observed=no';else echo 'boot-boundary-observed=yes';fi
  if [ "$action" = locked-resume ]; then
   # Only a verified uncommitted phase file may be discarded. Payload/backup stay guarded.
   if [ -e "$session/phase.next" ]; then rm "$session/phase.next";"$io" sync-dir "$session";fi
   [ ! -e "$session/restore.part" ] || error 'restore staging already present'
   cp -p "$session/backup" "$session/restore.part"
   "$io" sync-file "$session/restore.part"
   [ "$("$io" sha256 "$session/restore.part")" = "$version_sha" ] && [ "$("$io" metadata "$session/restore.part")" = "$version_meta" ] || error 'restore stage verification'
   mv "$session/restore.part" "$session/payload";"$io" sync-dir "$session";fault after-recover
   [ "$("$io" sha256 "$session/payload")" = "$version_sha" ] && [ "$("$io" metadata "$session/payload")" = "$version_meta" ] || error 'restored metadata or hash'
   phase recovered
   echo 'probe-phase=recovered'
   echo 'payload-content-and-metadata-restored=yes';echo 'next-operation=cleanup'
  else
   [ "$current_phase" = recovered ] && [ "$current_sha" = "$version_sha" ] && [ "$("$io" metadata "$session/payload")" = "$version_meta" ] || error 'cleanup requires verified recovery'
   # Pre-check above rejects every unknown entry. Remove known files only; never rm -rf.
   for file in phase.next publish.part restore.part; do [ ! -e "$session/$file" ] || error 'uncommitted staging blocks cleanup';done
   for file in payload backup baseline.sha baseline.meta phase boot-id lock marker; do rm "$session/$file";done
   rmdir "$session";"$io" sync-dir "$root"
   echo 'probe-phase=removed'
   echo 'probe-directory-removed=yes'
  fi
  ;;
esac
snapshot_stock > "$work/stock-after"
[ "$("$io" sha256 "$work/stock-before")" = "$("$io" sha256 "$work/stock-after")" ] || error 'read-only sources changed'
[ "$(mount_identity)" = "$mount_before" ] && [ "$(stat -c '%a %u %g %d %i' "$root")" = "$root_meta" ] || error 'storage mount or parent identity changed'
cat /proc/self/mountinfo > "$work/mountinfo-after"
[ "$("$io" sha256 "$work/mountinfo-after")" = "$mountinfo_before" ] || error 'mount topology changed'
printf '%s\n' 'read-only-sources-stable=yes' 'storage-identity-stable=yes' 'fsync-data-and-directory=completed' 'operation-complete=yes'
