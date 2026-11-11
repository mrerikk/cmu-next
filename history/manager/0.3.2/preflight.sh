#!/bin/sh
# Read-only observation of CMU targets and storage. Writes only caller-owned RAM files.
set -eu
set -f
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$#" -eq 2 ] || exit 2
work=$1;package=$2
[ ! -L "$work" ] || exit 2
tmp_root=$(CDPATH= cd -P /tmp && pwd)
work=$(CDPATH= cd -P "$work" && pwd)
[ "${work%/*}" = "$tmp_root" ] || exit 2
case "${work##*/}" in cmu-live-preflight.*) ;; *) exit 2;; esac
[ "$(cat "$work/marker")" = cmu-live-preflight-02 ] || exit 2
cmu_source_root=
stop(){ echo "stop: $*";exit 2; }
[ "$(id -u)" = 0 ] || stop 'root terminal required'
printf '%s\n' 'cmu-live-preflight=0.2' 'execution-context=cmu-native' 'internal-writes=none' 'storage-write-test=not-performed' 'live-installation=disabled' 'module-version=0.8' 'module-files=82' 'boot-input-files=2' 'boot-modifications=none'
printf 'effective-uid=%s\n' "$(id -u)"
echo 'kernel:';uname -a
fs=$(awk -v p="$work" '$2=="/"||p==$2||index(p,$2"/")==1{if(length($2)>n){n=length($2);fs=$3;count=1}else if(length($2)==n){count++}}END{if(count!=1)exit 1;print fs}' /proc/mounts) || stop 'ambiguous temporary mount'
case "$fs" in tmpfs|ramfs) ;; *) stop 'temporary work must be in memory';; esac
printf 'temporary-backing-filesystem=%s\n' "$fs"
cp "$package/cmu-io" "$work/cmu-io"
[ "$(md5sum "$work/cmu-io" | awk '{print $1}')" = 'fa48afeebb0c7765f42235bcf85858d7' ] || stop 'helper transport checksum mismatch'
chmod 700 "$work/cmu-io";io=$work/cmu-io
[ "$("$io" version)" = 'cmu-io 0.2' ] || stop 'helper version'
"$io" check "$io" '0a8f84c774eaae6572f99df49252a10a9ca64910162ef6d4fae414a17e486086' > /dev/null
printf abc > "$work/abc"
"$io" check "$work/abc" ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad > /dev/null
printf 'native-helper-sha256=0a8f84c774eaae6572f99df49252a10a9ca64910162ef6d4fae414a17e486086\n'
cp "$package/module.tsv" "$work/module.tsv"
"$io" check "$work/module.tsv" '6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b' > /dev/null
printf 'module-manifest-sha256=6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b\n'
# Manifest is a pinned data file, never sourced or executed.
[ "$(awk '$1=="file"{n++}END{print n}' "$work/module.tsv")" = 82 ] || stop 'target count'
# Refuse target symlinks, including existing ancestors of an absent target.
# Storage aliases are resolved separately by cd -P, and never used as write destinations here.
walk(){
 logical=$1
 case "$logical" in /*) ;; *) return 2;; esac
 rest=${logical#/};cursor=$cmu_source_root;anchor=${cmu_source_root:-/}
 while [ -n "$rest" ]; do
  part=${rest%%/*}
  case "$part" in ''|.|..) return 2;; esac
  case "$rest" in */*) rest=${rest#*/};; *) rest=;; esac
  cursor=$cursor/$part
  [ ! -L "$cursor" ] || return 2
  if [ -d "$cursor" ]; then
   anchor=$cursor
   [ -n "$rest" ] || return 2
  elif [ -e "$cursor" ]; then
   [ -z "$rest" ] && [ -f "$cursor" ] || return 2
   canonical=$(CDPATH= cd -P "${cursor%/*}" && pwd)/${cursor##*/}
   state=file;return 0
  else
   canonical=$(CDPATH= cd -P "$anchor" && pwd)/$part
   [ -z "$rest" ] || canonical=$canonical/$rest
   state=absent;return 0
  fi
 done
 return 2
}
record(){
 logical=$1;expected=$2
 walk "$logical" || stop "target type or symlink: $logical"
 case "$canonical$anchor" in *[!a-zA-Z0-9_./-]*) stop 'unsupported resolved path';; esac
 if [ "$state" = file ]; then
  [ "$expected" != absent ] || stop "unexpected existing target: $logical"
  hash=$("$io" sha256 "$canonical")
  [ "$hash" = "$expected" ] || stop "original checksum: $logical"
  meta=$("$io" metadata "$canonical")
 else
  [ "$expected" = absent ] || stop "missing original: $logical"
  hash=absent;meta=absent
 fi
 anchor=$(CDPATH= cd -P "$anchor" && pwd)
 ameta=$(stat -c '%a %u %g %d %i' "$anchor")
 printf 'target|%s|%s|%s|%s|%s|%s|%s\n' "$logical" "$state" "$canonical" "$anchor" "$hash" "$meta" "$ameta"
}
snapshot_targets(){
 record /jci/version.ini '7613d9b53aaf53bbc54a996737d38efe72bdf589f5839bb0d29622d6668dc340'
 record /jci/scripts/stage_usb.sh '2ec71fc955d0107a6e90d1ab4e6f00c9438b56d3e621ef018d57c8ef07bfae7f'
 record /jci/sm/sm.conf 'fa3484d7c644393ab6cb083990e483201129a207e7755459296dde8ec82a4d84'
 record /jci/gui/common/images/background.png '807b79209e0540fa4d0b8fe76a32b87f9e229089ecc722f874476001f85353b6'
 record /jci/gui/common/css/common.css '807d2215bf76c94978ce1e8aeb0f268665b14a6d326e89836ef641c79a8cc4d1'
 while read -r kind path before after payload mode extra; do
  [ "$kind" = file ] || continue
  record "/$path" "$before"
 done < "$work/module.tsv"
}
snapshot_storage(){
 for logical in /jci/gui /data /data_persist /resources /tmp; do
  real=$(CDPATH= cd -P "$cmu_source_root$logical" && pwd) || stop "cannot resolve $logical"
  case "$real" in *[!a-zA-Z0-9_./-]*) stop 'unsupported storage path';; esac
  meta=$(stat -c '%a %u %g %d %i' "$real")
  namespace=absent
  if [ -L "$real/cmu-next" ]; then namespace=symlink
  elif [ -d "$real/cmu-next" ]; then namespace=directory
  elif [ -e "$real/cmu-next" ]; then namespace=other;fi
  printf 'storage|%s|%s|%s|%s\n' "$logical" "$real" "$meta" "$namespace"
 done
}
cat /proc/self/mountinfo > "$work/mountinfo-before"
snapshot_targets > "$work/targets-before"
snapshot_storage > "$work/storage-before"
echo 'mountinfo-before-begin';cat "$work/mountinfo-before";echo 'mountinfo-before-end'
echo 'targets-before-begin';cat "$work/targets-before";echo 'targets-before-end'
echo 'storage-before-begin';cat "$work/storage-before";echo 'storage-before-end'
# Report each exact resolved filesystem rather than infer mounts from symlink names.
while IFS='|' read -r tag logical real meta namespace; do
 printf 'space-begin=%s\n' "$logical"
 df -k "$real"
 printf 'space-end=%s\n' "$logical"
done < "$work/storage-before"
snapshot_targets > "$work/targets-after"
snapshot_storage > "$work/storage-after"
cat /proc/self/mountinfo > "$work/mountinfo-after"
echo 'targets-after-begin';cat "$work/targets-after";echo 'targets-after-end'
echo 'storage-after-begin';cat "$work/storage-after";echo 'storage-after-end'
echo 'mountinfo-after-begin';cat "$work/mountinfo-after";echo 'mountinfo-after-end'
for kind in targets storage mountinfo; do
 [ "$("$io" sha256 "$work/$kind-before")" = "$("$io" sha256 "$work/$kind-after")" ] || stop "$kind changed during collection"
done
printf '%s\n' 'target-hashes-and-metadata-stable=yes' 'storage-resolution-stable=yes' 'mountinfo-stable=yes' 'preflight-complete=yes'
