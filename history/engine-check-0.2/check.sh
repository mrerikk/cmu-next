#!/bin/sh
# Execute the pinned v2 module only inside the caller-created /tmp rootfs copy.
set -eu
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$#" -eq 2 ] || exit 2
work=$1; package=$2
[ ! -L "$work" ] || exit 2
tmp_root=$(CDPATH= cd -P /tmp && pwd)
work=$(CDPATH= cd -P "$work" && pwd)
[ "${work%/*}" = "$tmp_root" ] || exit 2
case "${work##*/}" in cmu-engine-check.*) ;; *) exit 2;; esac
[ "$(cat "$work/marker")" = cmu-engine-check-02 ] || exit 2
cmu_source_root=
printf '%s\n' 'cmu-engine-check=0.2' 'execution-context=cmu-native' 'coordinator-version=0.2' 'module-format=2' 'module-version=0.8' 'module-files=82' 'internal-system-files-changed=no' 'test-target=fresh temporary rootfs copy only'
printf 'effective-uid=%s\n' "$(id -u)"
echo 'identity:'; id
echo 'kernel:'; uname -a
echo 'mounts:'; cat /proc/mounts
temporary_fs=$(awk -v p="$work" '$2=="/"||p==$2||index(p,$2"/")==1{if(length($2)>n){n=length($2);fs=$3;count=1}else if(length($2)==n){count++}}END{if(count!=1)exit 1;print fs}' /proc/mounts)
printf 'temporary-backing-filesystem=%s\n' "$temporary_fs"
case "$temporary_fs" in tmpfs|ramfs) ;; *) echo 'stop: temporary module test requires memory-backed filesystem'; exit 2;; esac
echo 'space:'; df -k / /jci /data /data_persist /resources /tmp 2>&1 || :
# Verify the helper before any native execution. No payload executable is invoked.
cp "$package/cmu-io" "$work/cmu-io"
[ "$(md5sum "$work/cmu-io" | awk '{print $1}')" = 'fa48afeebb0c7765f42235bcf85858d7' ] || { echo 'stop: helper transport checksum mismatch'; exit 2; }
chmod 700 "$work/cmu-io";io=$work/cmu-io
[ "$("$io" version)" = 'cmu-io 0.2' ] || { echo 'stop: native helper version or execution failed'; exit 2; }
"$io" check "$io" '0a8f84c774eaae6572f99df49252a10a9ca64910162ef6d4fae414a17e486086'
printf abc > "$work/abc"
"$io" check "$work/abc" ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
printf '%s\n' 'native-helper-sha256=pass' 'native-helper-sha256-value=0a8f84c774eaae6572f99df49252a10a9ca64910162ef6d4fae414a17e486086'
cp "$package/engine.sh" "$work/engine.sh";"$io" check "$work/engine.sh" '41d1c3a3c73b6cd08f661c1ab5354d01a3d460c981844228fe4eb157083fb88d'
printf 'coordinator-sha256=41d1c3a3c73b6cd08f661c1ab5354d01a3d460c981844228fe4eb157083fb88d\n'
# Probe script and all further executables are verified and run from RAM.
"$io" check "$package/probe.sh" 'd8361fcfd4b78675d145d19f685a63c29d0e18c0a013a2324c90daa2a2bd87ff'
probe=$(mktemp -d /tmp/cmu-probe.XXXXXX);printf 'cmu-probe-01\n' > "$probe/marker"
cp "$package/probe.sh" "$probe/probe.sh";"$io" check "$probe/probe.sh" 'd8361fcfd4b78675d145d19f685a63c29d0e18c0a013a2324c90daa2a2bd87ff'
echo "capability-temporary-path=$probe"
echo 'capability-report-begin'
sh "$probe/probe.sh" "$probe" || echo 'capability-report-collection-error'
echo 'capability-report-end'
lab=$work/lab
mkdir -p "$lab/rootfs/jci/gui/common/images" "$lab/rootfs/jci/gui/common/css" "$lab/native-state/transactions"
chmod 700 "$lab/native-state" "$lab/native-state/transactions"
printf 'cmu-native-lab-02\n' > "$lab/native-lab.txt"
copy_input() {
 rel=$1;expected=$2;number=$3;physical=$cmu_source_root/$rel
 "$io" check "$physical" "$expected"
 printf 'internal-input-sha256-before=%s %s\n' "$expected" "$rel"
 "$io" metadata "$physical" > "$work/source-$number.meta"
 cp -p "$physical" "$lab/rootfs/$rel"
 [ "$("$io" metadata "$lab/rootfs/$rel")" = "$(cat "$work/source-$number.meta")" ]
}
copy_input jci/version.ini '7613d9b53aaf53bbc54a996737d38efe72bdf589f5839bb0d29622d6668dc340' 1
copy_input jci/gui/index.html 'b0e116b941f29078ced19b864a1b888cf76d8bc3e4974af081efca4693e5c420' 2
copy_input jci/gui/common/images/background.png '807b79209e0540fa4d0b8fe76a32b87f9e229089ecc722f874476001f85353b6' 3
copy_input jci/gui/common/css/common.css '807d2215bf76c94978ce1e8aeb0f268665b14a6d326e89836ef641c79a8cc4d1' 4
echo 'internal-input-metadata-copied=pass'
module=$package/module
"$io" check "$module/module.tsv" '6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b'
cp "$module/module.tsv" "$work/module.tsv";"$io" check "$work/module.tsv" '6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b'
printf 'module-manifest-sha256=6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b\n'
run() {
 action=$1;arg=${2:-$module}
 case "$action" in plan|apply) "$io" check "$module/module.tsv" '6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b' > /dev/null;; esac
 sh "$work/engine.sh" "$io" "$lab" "$action" "$arg"
}
check_clone() {
 [ "$("$io" sha256 "$lab/rootfs/jci/version.ini")" = '7613d9b53aaf53bbc54a996737d38efe72bdf589f5839bb0d29622d6668dc340' ]
 [ "$("$io" sha256 "$lab/rootfs/jci/gui/common/images/background.png")" = '807b79209e0540fa4d0b8fe76a32b87f9e229089ecc722f874476001f85353b6' ]
 [ "$("$io" sha256 "$lab/rootfs/jci/gui/common/css/common.css")" = '807d2215bf76c94978ce1e8aeb0f268665b14a6d326e89836ef641c79a8cc4d1' ]
 while read -r kind path before after payload mode extra; do
  [ "$kind" = file ] || continue
  if [ "$before" = absent ]; then [ ! -e "$lab/rootfs/$path" ] && [ ! -L "$lab/rootfs/$path" ]
  else "$io" check "$lab/rootfs/$path" "$before"; fi
 done < "$work/module.tsv"
 [ "$("$io" metadata "$lab/rootfs/jci/version.ini")" = "$(cat "$work/source-1.meta")" ]
 [ "$("$io" metadata "$lab/rootfs/jci/gui/index.html")" = "$(cat "$work/source-2.meta")" ]
 [ "$("$io" metadata "$lab/rootfs/jci/gui/common/images/background.png")" = "$(cat "$work/source-3.meta")" ]
 [ "$("$io" metadata "$lab/rootfs/jci/gui/common/css/common.css")" = "$(cat "$work/source-4.meta")" ]
 for rel in jci/gui/common/images/cmu-next-layout jci/gui/common/fonts jci/gui/common/js; do [ ! -e "$lab/rootfs/$rel" ]; done
}
[ "$(run plan)" = 'install connect2-layout 82' ]
echo 'v2-module-plan=pass'
[ "$(run apply)" = 'installed t000001 connect2-layout 82' ]
[ "$(run apply)" = 'already-installed t000001' ]
"$io" check "$lab/rootfs/jci/gui/index.html" '2912d866db80fbd4f9546f811b27b0acc78935ff38519849c35f6b386efc8ae5'
echo 'temporary-install-and-repeat=pass'
[ "$(run restore t000001)" = 'restored t000001' ]
[ "$(run restore t000001)" = 'already-restored t000001' ]
check_clone
echo 'temporary-restore-and-metadata=pass'
"$io" check "$module/module.tsv" '6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b'
set +e
CMU_DEVICE_LAB_FAULT=after-publish:82 sh "$work/engine.sh" "$io" "$lab" apply "$module"
crashed=$?
set -e
[ "$crashed" -eq 137 ] || { echo "stop: expected install child SIGKILL, got $crashed"; exit 2; }
"$io" check "$lab/rootfs/jci/gui/index.html" '2912d866db80fbd4f9546f811b27b0acc78935ff38519849c35f6b386efc8ae5'
echo 'temporary-loader-last-published=pass'
set +e
CMU_DEVICE_LAB_FAULT=after-restore:82 sh "$work/engine.sh" "$io" "$lab" restore t000002
crashed=$?
set -e
[ "$crashed" -eq 137 ] || { echo "stop: expected restore child SIGKILL, got $crashed"; exit 2; }
"$io" check "$lab/rootfs/jci/gui/index.html" 'b0e116b941f29078ced19b864a1b888cf76d8bc3e4974af081efca4693e5c420'
[ -f "$lab/rootfs/jci/gui/common/js/cmu-next-layout.js" ]
echo 'temporary-loader-first-restored=pass'
[ "$(run recover t000002)" = 'restored t000002' ];check_clone
echo 'temporary-interrupted-restore-recovery=pass'
"$io" check "$module/module.tsv" '6da2ac66abd5b51aa7bc76e53e007b051f74b5c35cde15d69026eb11533fa94b'
set +e
CMU_DEVICE_LAB_FAULT=after-publish:80 sh "$work/engine.sh" "$io" "$lab" apply "$module"
crashed=$?
set -e
[ "$crashed" -eq 137 ] || { echo "stop: expected font child SIGKILL, got $crashed"; exit 2; }
"$io" check "$lab/rootfs/jci/gui/index.html" 'b0e116b941f29078ced19b864a1b888cf76d8bc3e4974af081efca4693e5c420'
[ -f "$lab/rootfs/jci/gui/common/fonts/cmu-next-layout/source-sans-3.ttf" ]
[ ! -e "$lab/rootfs/jci/gui/common/js/cmu-next-layout.js" ]
[ "$(run recover t000003)" = 'restored t000003' ];check_clone
echo 'temporary-font-publish-recovery=pass'
# Compare actual CMU inputs again, both bytes and metadata. Only four input paths were read.
verify_input() {
 rel=$1;expected=$2;number=$3;physical=$cmu_source_root/$rel
 "$io" check "$physical" "$expected"
 [ "$("$io" metadata "$physical")" = "$(cat "$work/source-$number.meta")" ]
 printf 'internal-input-sha256-after=%s %s\n' "$expected" "$rel"
}
verify_input jci/version.ini '7613d9b53aaf53bbc54a996737d38efe72bdf589f5839bb0d29622d6668dc340' 1
verify_input jci/gui/index.html 'b0e116b941f29078ced19b864a1b888cf76d8bc3e4974af081efca4693e5c420' 2
verify_input jci/gui/common/images/background.png '807b79209e0540fa4d0b8fe76a32b87f9e229089ecc722f874476001f85353b6' 3
verify_input jci/gui/common/css/common.css '807d2215bf76c94978ce1e8aeb0f268665b14a6d326e89836ef641c79a8cc4d1' 4
echo 'internal-input-hashes-unchanged=pass'
echo 'internal-input-metadata-unchanged=pass'
echo 'engine-check-complete=yes'
echo 'live-installation=not performed'
echo 'persistent-journal-filesystem=not tested'
echo 'power-loss-durability=not tested'
echo 'opera-rendering=not tested'
