#!/bin/sh
# Development adapter: all actions operate only on the caller-owned RAM firmware copy.
set -eu
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$#" -eq 4 ] || exit 2
work=$1;packages=$2;action=$3;item=$4
[ ! -L "$work" ] || exit 2
work=$(CDPATH= cd -P "$work" && pwd)
tmp=$(CDPATH= cd -P /tmp && pwd)
[ "${work%/*}" = "$tmp" ] || exit 2
case "${work##*/}" in cmu-manager.*) ;; *) exit 2;; esac
[ "$(cat "$work/marker")" = cmu-manager-ram-01 ] || exit 2
[ "$(cat "$work/lab/native-lab.txt")" = cmu-native-lab-02 ] || exit 2
fs=$(awk -v p="$work" '$2=="/"||p==$2||index(p,$2"/")==1{if(length($2)>n){n=length($2);fs=$3;c=1}else if(length($2)==n){c++}}END{if(c!=1)exit 1;print fs}' /proc/mounts)
case "$fs" in tmpfs|ramfs) ;; *) echo 'error: memory-backed lab required';exit 2;; esac
io=$work/cmu-io
run(){ sh "$work/engine.sh" "$io" "$work/lab" "$@"; }
case "$action" in
 install)
  case "$item" in ''|*[!a-z0-9-]*) exit 2;; esac
  [ ! -L "$packages/packages" ] && [ ! -L "$packages/packages/$item" ] && [ -d "$packages/packages/$item/module" ] || exit 2
  echo 'phase=validating';run plan "$packages/packages/$item/module"
  echo 'phase=installing';run apply "$packages/packages/$item/module"
  ;;
 rollback)
  case "$item" in t[0-9][0-9][0-9][0-9][0-9][0-9]) ;; *) exit 2;; esac
  echo 'phase=restoring';run restore "$item"
  ;;
 backup)
  # Initial checkpoint only; it records exactly the four stock inputs and 81 absent destinations.
  # Once installed, each module's transaction carries its own original-file backup for rollback.
  [ ! -e "$work/checkpoint" ] && [ ! -L "$work/checkpoint" ] || { echo 'error: initial checkpoint already exists';exit 2; }
  for tx in "$work/lab/native-state/transactions/"*; do
   [ ! -e "$tx" ] || { echo 'error: create initial checkpoint before the first installation';exit 2; }
  done
  echo 'phase=creating-backup'
  mkdir "$work/checkpoint"
  tar -cpf "$work/checkpoint/stock.tar.part" -C "$work/lab/rootfs" jci
  "$io" sync-file "$work/checkpoint/stock.tar.part"
  "$io" sha256 "$work/checkpoint/stock.tar.part" > "$work/checkpoint/stock.sha256"
  mv "$work/checkpoint/stock.tar.part" "$work/checkpoint/stock.tar"
  "$io" sync-file "$work/checkpoint/stock.sha256";"$io" sync-dir "$work/checkpoint"
  printf 'cmu-manager-checkpoint-01\n' > "$work/checkpoint/complete"
  "$io" sync-file "$work/checkpoint/complete";"$io" sync-dir "$work/checkpoint"
  echo 'backup-created: four original files in RAM; not a full firmware image'
  ;;
 restore)
  [ "$(cat "$work/checkpoint/complete")" = cmu-manager-checkpoint-01 ] || exit 2
  "$io" check "$work/checkpoint/stock.tar" "$(cat "$work/checkpoint/stock.sha256")"
  echo 'phase=restoring-originals'
  # Restore newest transactions first, through the engine's conflict and metadata checks.
  for tx in $(ls -1 "$work/lab/native-state/transactions" | sort -r); do
   case "$tx" in t[0-9][0-9][0-9][0-9][0-9][0-9]) ;; *) exit 2;; esac
   phase=$(cat "$work/lab/native-state/transactions/$tx/phase")
   case "$phase" in installed) run restore "$tx";;restored) ;; *) echo 'error: transaction recovery required';exit 2;; esac
  done
  verify=$(mktemp -d "$work/checkpoint-verify.XXXXXX")
  tar -xpf "$work/checkpoint/stock.tar" -C "$verify"
  for dir in "$verify" "$work/lab/rootfs"; do
   [ -z "$(find "$dir" -type l -print)" ] || exit 2
   (cd "$dir" && find . -type f -print | LC_ALL=C sort) > "$work/verify-paths"
   : > "$work/verify-inventory"
   while IFS= read -r rel; do
    printf '%s %s %s\n' "$rel" "$("$io" sha256 "$dir/$rel")" "$("$io" metadata "$dir/$rel")" >> "$work/verify-inventory"
   done < "$work/verify-paths"
   if [ "$dir" = "$verify" ]; then baseline=$("$io" sha256 "$work/verify-inventory");else [ "$("$io" sha256 "$work/verify-inventory")" = "$baseline" ] || { echo 'error: checkpoint differs';exit 2; };fi
  done
  echo 'checkpoint-file-content-and-metadata=verified'
  echo 'original-transactions-restored: checkpoint archive retained' 
  ;;
 report)
  usb=$(CDPATH= cd -P "$packages/.." && pwd)
  case "$usb" in /tmp/mnt/sd[a-d]1) ;; *) exit 2;; esac
  sh "$work/prepare-usb.sh" "$usb"
  n=1
  while [ "$n" -le 999 ]; do
   destination=$usb/cmu-manager-report-$n
   if mkdir "$destination" 2>/dev/null; then break;fi
   n=$((n+1))
  done
  [ "$n" -le 999 ] || exit 2
  {
   echo 'cmu-manager-report=0.1';echo 'mode=ram-lab';echo 'live-installation=disabled'
   cat "$work/startup.txt"
   for log in "$work/history/"*.log; do
    [ -f "$log" ] || continue
    echo "job-log-begin=${log##*/}";cat "$log";echo "job-log-end=${log##*/}"
   done
   echo 'report-collected=yes'
  } > "$destination/report.txt.part"
  mv "$destination/report.txt.part" "$destination/report.txt"
  sync
  echo "saved: $destination/report.txt"
  ;;
 *) exit 2;;
esac
echo 'result=success'
