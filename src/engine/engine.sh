#!/bin/sh
# Lab-only portable transaction coordinator; no live mount/remount or startup changes.
set -eu
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$#" -ge 3 ] || { echo 'usage: engine.sh io lab plan|apply|restore|recover|status module-or-transaction'; exit 2; }
io=$1; lab=$2; action=$3; arg=${4:-}
error() { echo "error: $*" >&2; exit 2; }
[ "$("$io" version)" = "cmu-io 0.2" ] || error 'cmu-io 0.2 required'
[ ! -L "$lab" ] || error 'symlink lab'
lab=$(CDPATH= cd -P "$lab" && pwd) || exit 2
[ "$lab" != / ] || error 'live root refused'
[ "$(cat "$lab/native-lab.txt")" = cmu-native-lab-02 ] || error 'lab marker required'
root=$lab/rootfs; state=$lab/native-state
[ -d "$root" ] && [ ! -L "$root" ] && [ -d "$state" ] && [ ! -L "$state" ] || error 'invalid lab directories'
if [ -z "${CMU_IO_LOCK_FD:-}" ]; then
 exec "$io" lock-run "$state/lock" /bin/sh "$0" "$@"
fi
"$io" lock-check "$state/lock" >/dev/null || error 'invalid transaction lock'
[ ! -L "$state/transactions" ] && [ -d "$state/transactions" ] || error 'invalid transactions directory'
work=$(mktemp -d "$state/validation.XXXXXX") || exit 2
trap 'rm -f "$work/files" "$work/dirs" "$work/dirs-reverse" "$work/sizes" "$work/restore-files"; rmdir "$work" 2>/dev/null || :' EXIT
hash() { "$io" sha256 "$1"; }
valid_hash() { [ "${#1}" -eq 64 ] || return 1; case "$1" in *[!0-9a-f]*) return 1;; esac; }
valid_rel() {
 case "$1" in ''|/*|*//*|*/|.|..|*/../*|../*|*/..|*/./*|./*|*/.|*[!a-zA-Z0-9._/-]*) return 1;; esac
 [ "${#1}" -le 240 ]
}
walk() {
 base=$1; rel=$2; valid_rel "$rel" || error 'unsafe relative path'
 oldifs=$IFS; IFS=/; set -f; set -- $rel; IFS=$oldifs
 for part do base=$base/$part; [ ! -L "$base" ] || error 'symlink in path'; done
 set +f
}
syncfile() { "$io" sync-file "$1" >/dev/null; }
syncdir() { "$io" sync-dir "$1" >/dev/null; }
phase() {
 printf '%s\n' "$2" > "$1/phase.next"; syncfile "$1/phase.next"
 mv "$1/phase.next" "$1/phase"; syncdir "$1"
}
fault() { if [ "${CMU_DEVICE_LAB_FAULT:-}" = "$1" ]; then kill -KILL $$; fi; }
metadata() { "$io" metadata "$1"; }
current_hash() { if [ -e "$1" ]; then hash "$1"; else echo absent; fi; }
validate_table() {
 awk '{name=tolower($1); for(p in seen) if(name==p || index(name,p "/")==1 || index(p,name "/")==1)exit 1;seen[name]=1;n++} END {if(n<1||n>256)exit 1}' "$1" || error 'duplicate, ancestor or excessive targets'
}
parse() {
 module=$1; [ ! -L "$module/module.tsv" ] || error 'symlink manifest'
 manifest_hash=$(hash "$module/module.tsv")
 module_id=; module_version=; firmware=; count=0; first=yes
 : > "$work/files"
 while IFS=' ' read -r kind a b c d e extra || [ -n "$kind" ]; do
  if [ "$first" = yes ]; then
   case "$kind" in cmu-module-v1) format=1;; cmu-module-v2) format=2;; *) error 'manifest header';; esac
   [ -z "$a$b$c$d$e$extra" ] || error 'manifest header fields'
   required_engine=; first=no; continue
  fi
  case "$kind" in
   engine) [ "$format" -eq 2 ] && [ "$count" -eq 0 ] && [ -z "$required_engine$b$c$d$e$extra" ] && [ "$a" = 0.2 ] || error 'coordinator requirement'; required_engine=$a;;
   id) [ "$count" -eq 0 ] && [ -z "$module_id$b$c$d$e$extra" ] || error 'id record'; module_id=$a;;
   version) [ "$count" -eq 0 ] && [ -z "$module_version$b$c$d$e$extra" ] || error 'version record'; module_version=$a;;
   firmware) [ "$count" -eq 0 ] && [ -z "$firmware$b$c$d$e$extra" ] || error 'firmware record'; firmware=$a;;
   file)
    [ "$format" -eq 1 ] || [ "$required_engine" = 0.2 ] || error 'coordinator version required'
    [ -n "$module_id" ] && [ -n "$module_version" ] && valid_hash "$firmware" || error 'missing module identity' 
    valid_rel "$a" && valid_rel "$d" || error 'file path'
    case "$a" in */.cmu-*) error 'reserved staging name';; jci/gui/*) ;; *) error 'non-gui target';; esac
    case "$b" in absent) ;; *) valid_hash "$b" || error 'old hash';; esac
    valid_hash "$c" && [ "$b" != "$c" ] && [ -z "$extra" ] || error 'new hash or no-op record'
    case "$e" in 0644|0755) ;; *) error 'mode';; esac
    walk "$root" "$a"; walk "$module" "$d"
    [ "$(hash "$module/$d")" = "$c" ] || error 'payload changed'
    printf '%s %s %s %s %s\n' "$a" "$b" "$c" "$d" "$e" >> "$work/files"
    count=$((count+1));;
   *) error 'unknown manifest record';;
  esac
 done < "$module/module.tsv"
 case "$module_id" in [a-z]* ) ;; *) error 'module id';; esac
 case "$module_id" in *[!a-z0-9-]*) error 'module id characters';; esac
 [ "${#module_id}" -le 64 ] && [ -n "$module_version" ] && [ "${#module_version}" -le 64 ] || error 'module identity size'
 case "$module_version" in *[!a-z0-9.-]*) error 'module version';; esac
 valid_hash "$firmware" && [ "$firmware" = "$(hash "$root/jci/version.ini")" ] || error 'firmware mismatch'
 validate_table "$work/files"
}
check_originals() {
 while read -r path before after payload mode; do
  walk "$root" "$path"
  [ "$(current_hash "$root/$path")" = "$before" ] || error "original changed: $path"
 done < "$work/files"
}
space_check() {
 : > "$work/sizes"
 while read -r path before after payload mode; do
  oldbytes=0
  if [ "$before" != absent ]; then set -- $(metadata "$root/$path"); oldbytes=$6; fi
  set -- $(metadata "$module/$payload"); newbytes=$6
  awk -v o="$oldbytes" -v n="$newbytes" 'BEGIN{exit !(o>=0&&o<=16777216&&n>=0&&n<=16777216)}' || error 'file exceeds 16 MiB limit'
  printf '%s %s\n' "$oldbytes" "$newbytes" >> "$work/sizes"
 done < "$work/files"
 needed=$(awk '{old+=$1;new+=$2;if($1>largest)largest=$1;if($2>largest)largest=$2}END{if(new>67108864)exit 1;printf "%.0f",old+new+largest+16777216}' "$work/sizes") || error 'payload set exceeds 64 MiB'
 for location in "$root" "$state"; do
  available=$(df -Pk "$location" | awk 'NR>1&&NF>=4{if($1~/^[0-9]+$/)v=$3;else v=$4}END{if(v!~/^[0-9]+$/)exit 1;print v}') || error 'cannot determine free space'
  awk -v kb="$available" -v bytes="$needed" 'BEGIN{exit !(kb*1024>=bytes)}' || error 'insufficient free space for backup, payload, scratch and reserve'
 done
}
verify_transaction() {
 tx=$1
 case "$tx" in t[0-9][0-9][0-9][0-9][0-9][0-9]) ;; *) error 'transaction id';; esac
 folder=$state/transactions/$tx
 [ -d "$folder" ] && [ ! -L "$folder" ] || error 'transaction directory'
 "$io" check "$folder/files" "$(cat "$folder/files.sha256")" >/dev/null || error 'damaged file table'
 valid_hash "$(cat "$folder/firmware.sha256")" && [ "$(hash "$root/jci/version.ini")" = "$(cat "$folder/firmware.sha256")" ] || error 'firmware changed since installation'
 validate_table "$folder/files"
 while read -r path before after payload mode; do
  valid_rel "$path" || error 'journal target'; case "$path" in jci/gui/*) ;; *) error 'journal scope';; esac
  case "$path" in */.cmu-*) error 'reserved journal staging name';; esac
  valid_hash "$after" || error 'journal hash'; case "$before" in absent) ;; *) valid_hash "$before" || error 'journal original';; esac
  case "$mode" in 0644|0755) ;; *) error 'journal mode';; esac
  walk "$root" "$path"
 done < "$folder/files"
}
read_dirs_log() {
 awk 'BEGIN{seen=0} $1=="sha256"{if(NF!=2||seen++)exit 1;next} {if(seen)exit 1; print} END{if(seen!=1)exit 1}' "$folder/created-dirs" > "$work/dirs" || error 'damaged directory journal'
 expected=$(awk 'END{print $2}' "$folder/created-dirs")
 valid_hash "$expected" && [ "$(hash "$work/dirs")" = "$expected" ] || error 'directory journal checksum'
 while read -r dir; do
  valid_rel "$dir" || error 'created directory path'
  case "$dir" in jci/gui/*) ;; *) error 'created directory scope';; esac
  awk -v p="$dir/" 'index($1,p)==1{ok=1}END{exit !ok}' "$folder/files" || error 'directory outside module targets'
  walk "$root" "$dir"
 done < "$work/dirs"
}
write_dirs_log() {
 cp "$work/dirs" "$folder/created-dirs.next"
 expected=$(hash "$folder/created-dirs.next")
 printf 'sha256 %s\n' "$expected" >> "$folder/created-dirs.next"
 syncfile "$folder/created-dirs.next"
 mv "$folder/created-dirs.next" "$folder/created-dirs"; syncdir "$folder"
}
ensure_parent() {
 rel=${1%/*}; location=$root; suffix=
 oldifs=$IFS; IFS=/; set -f; set -- $rel; IFS=$oldifs
 for part do
  suffix=${suffix:+$suffix/}$part; location=$location/$part
  [ ! -L "$location" ] || error 'parent symlink'
  if [ ! -d "$location" ]; then
   read_dirs_log
   printf '%s\n' "$suffix" >> "$work/dirs"; write_dirs_log
   mkdir -m 755 "$location"; syncdir "${location%/*}"; syncdir "$location"
  fi
 done
 set +f
}
restore() {
 verify_transaction "$arg"
 status=$(cat "$folder/phase")
 case "$status" in prepared|installing|installed|restoring|restored) ;; *) error 'unsupported transaction phase';; esac
 # Validate the entire backup/current set before modifying any destination.
 i=0
 while read -r path before after payload mode; do
  i=$((i+1)); now=$(current_hash "$root/$path")
  if [ "$status" = restored ] && [ "$now" != "$before" ]; then error 'restored transaction no longer matches original'; fi
  if [ "$before" != absent ]; then
   [ "$(hash "$folder/backup-$i")" = "$before" ] || error 'damaged backup'
   [ "$(metadata "$folder/backup-$i")" = "$(cat "$folder/before-$i")" ] || error 'backup metadata changed'
  fi
  if [ "$now" = "$before" ]; then
   [ "$before" = absent ] || [ "$(metadata "$root/$path")" = "$(cat "$folder/before-$i")" ] || error 'original metadata changed'
  elif [ "$now" = "$after" ]; then
   [ "$(metadata "$root/$path")" = "$(cat "$folder/after-$i")" ] || error 'installed metadata changed'
  else error "external change blocks restore: $path"; fi
 done < "$folder/files"
 read_dirs_log
 if [ "$status" = restored ]; then echo "already-restored $arg"; return; fi
 phase "$folder" restoring
 awk '{a[NR]=NR " " $0}END{for(i=NR;i>0;i--)print a[i]}' "$folder/files" > "$work/restore-files"
 while read -r i path before after payload mode; do
  target=$root/$path; scratch=${target%/*}/.cmu-$arg-$i
  [ ! -L "$scratch" ] || error 'scratch symlink'
  if [ -e "$scratch" ]; then [ -f "$scratch" ] || error 'scratch type'; rm "$scratch"; syncdir "${scratch%/*}"; fi
  if [ "$(current_hash "$target")" != "$before" ]; then
   if [ "$before" = absent ]; then rm "$target"; syncdir "${target%/*}"
   else
    (set -C; : > "$scratch") || error 'scratch exists'
    cp -p "$folder/backup-$i" "$scratch"
    [ "$(hash "$scratch")" = "$before" ] && [ "$(metadata "$scratch")" = "$(cat "$folder/before-$i")" ] || error 'restore staging failed'
    syncfile "$scratch"; fault "before-restore:$i"
    mv "$scratch" "$target"; syncdir "${target%/*}"
   fi
  fi
  [ "$(current_hash "$target")" = "$before" ] || error 'restore verification'
  fault "after-restore:$i"
 done < "$work/restore-files"
 awk '{a[NR]=$0}END{for(i=NR;i>0;i--)print a[i]}' "$work/dirs" > "$work/dirs-reverse"
 while read -r rel; do
  valid_rel "$rel" || error 'created directory record';case "$rel" in jci/gui/*) ;; *) error 'directory scope';; esac
  walk "$root" "$rel"
  if [ -d "$root/$rel" ]; then if rmdir "$root/$rel" 2>/dev/null; then syncdir "${root}/${rel%/*}"; fi; fi
 done < "$work/dirs-reverse"
 phase "$folder" restored
 echo "restored $arg"
}
case "$action" in
 status) for f in "$state"/transactions/t??????; do [ -d "$f" ] || continue; echo "${f##*/} $(cat "$f/phase" 2>/dev/null || echo incomplete-staging)"; done; exit 0;;
 restore|recover) restore; exit 0;;
 plan|apply) ;;
 *) error 'unknown action';;
esac
[ -n "$arg" ] && [ -d "$arg" ] || error 'module directory'
module=$(CDPATH= cd -P "$arg" && pwd); parse "$module"
# Inspect all pending transactions before returning an idempotent installed result.
for pending in "$state"/transactions/t??????; do
 [ -d "$pending" ] || continue
 [ ! -L "$pending" ] || error 'transaction symlink'
 status=$(cat "$pending/phase" 2>/dev/null || echo incomplete-staging)
 case "$status" in prepared|installing|restoring) error "recovery required: ${pending##*/}";; installed|restored|incomplete-staging) ;; *) error 'unknown prior state';; esac
done
for prior in "$state"/transactions/t??????; do
 [ -d "$prior" ] || continue
 status=$(cat "$prior/phase" 2>/dev/null || echo incomplete-staging)
 case "$status" in prepared|installing|restoring) error "recovery required: ${prior##*/}";; restored|incomplete-staging) continue;; installed) ;; *) error 'unknown prior state';; esac
 "$io" check "$prior/files" "$(cat "$prior/files.sha256")" >/dev/null || error 'damaged prior table'
 if [ "$(cat "$prior/module.sha256")" = "$manifest_hash" ]; then
  i=0
  while read -r path before after payload mode; do
   i=$((i+1))
   [ "$(hash "$root/$path")" = "$after" ] || error 'installed content changed'
   [ "$(metadata "$root/$path")" = "$(cat "$prior/after-$i")" ] || error 'installed metadata changed'
  done < "$work/files"
  echo "already-installed ${prior##*/}"; exit 0
 fi
 [ "$(cat "$prior/module-id")" != "$module_id" ] || error 'restore previous module version first'
 awk 'FNR==NR{seen[tolower($1)]=1;next} {for(p in seen)if(p==tolower($1)||index(p,tolower($1) "/")==1||index(tolower($1),p "/")==1)exit 1}' "$prior/files" "$work/files" || error 'another module owns target'
done
check_originals
space_check
if [ "$action" = plan ]; then echo "install $module_id $count"; exit 0; fi
n=1
# Preparation is not an active transaction. Retain interrupted staging for inspection,
# but never enumerate it as a transaction that can block journal recovery.
while :; do
 tx=$(printf 't%06d' "$n"); [ "$n" -le 999999 ] || error 'transaction limit'
 destination=$state/transactions/$tx
 folder=$state/transactions/.staging-$tx
 if [ ! -e "$destination" ] && [ ! -L "$destination" ] && mkdir "$folder" 2>/dev/null;then break;fi
 n=$((n+1))
done
fault preparing
cp "$work/files" "$folder/files"; hash "$folder/files" > "$folder/files.sha256"
printf '%s\n' "$manifest_hash" > "$folder/module.sha256"
printf '%s\n' "$module_id" > "$folder/module-id"
printf '%s\n' "$firmware" > "$folder/firmware.sha256"
: > "$work/dirs"; write_dirs_log
i=0
while read -r path before after payload mode; do
 i=$((i+1)); target=$root/$path; scratch=${target%/*}/.cmu-$tx-$i
 [ ! -e "$scratch" ] && [ ! -L "$scratch" ] || error 'pre-existing scratch'
 if [ "$before" != absent ]; then
  metadata "$target" > "$folder/before-$i"
  cp -p "$target" "$folder/backup-$i"
  [ "$(hash "$folder/backup-$i")" = "$before" ] && [ "$(metadata "$folder/backup-$i")" = "$(cat "$folder/before-$i")" ] || error 'backup verification failed'
  syncfile "$folder/backup-$i"; syncfile "$folder/before-$i"
 fi
 "$io" stage "$module/$payload" "$folder/payload-$i" "$after" >/dev/null
 fault "staged-payload:$i"
 done < "$folder/files"
for name in files files.sha256 module.sha256 module-id firmware.sha256 created-dirs; do syncfile "$folder/$name"; done
syncdir "$folder"; syncdir "$state/transactions"
phase "$folder" prepared
fault staged-prepared
# Publish the complete, synced journal directory before any destination mutation.
[ ! -e "$destination" ] && [ ! -L "$destination" ] || error 'transaction destination appeared'
mv "$folder" "$destination"; syncdir "$state/transactions"
folder=$destination
fault prepared
check_originals
i=0
while read -r path before after payload mode; do
 i=$((i+1))
 if [ "$before" != absent ]; then [ "$(metadata "$root/$path")" = "$(cat "$folder/before-$i")" ] || error 'original metadata changed after backup'; fi
done < "$folder/files"
phase "$folder" installing
i=0
while read -r path before after payload mode; do
 i=$((i+1)); ensure_parent "$path"; target=$root/$path; scratch=${target%/*}/.cmu-$tx-$i
 [ "$(current_hash "$target")" = "$before" ] || error 'target changed before commit'
 if [ "$before" != absent ]; then [ "$(metadata "$target")" = "$(cat "$folder/before-$i")" ] || error 'metadata changed before commit'; fi
 (set -C; : > "$scratch") || error 'scratch exists'
 if [ "$before" != absent ]; then cp -p "$folder/backup-$i" "$scratch"; fi
 cat "$folder/payload-$i" > "$scratch"; chmod "$mode" "$scratch"
 [ "$(hash "$scratch")" = "$after" ] || error 'new data verification failed'
 metadata "$scratch" > "$folder/after-$i"; syncfile "$folder/after-$i"; syncdir "$folder"
 syncfile "$scratch"; fault "before-publish:$i"
 mv "$scratch" "$target"; syncdir "${target%/*}"
 [ "$(hash "$target")" = "$after" ] || error 'published verification failed'
 fault "after-publish:$i"
done < "$folder/files"
phase "$folder" installed
echo "installed $tx $module_id $count"
