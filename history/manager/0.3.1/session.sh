#!/bin/sh
# Called only as a pinned RAM component under the inherited bootstrap lock.
set -eu
umask 077
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$#" -eq 3 ] || exit 2
work=$1;base=$2;control=$3
io=$work/cmu-io
"$io" lock-check "$work/bootstrap.lock" >/dev/null
[ "$(cat "$work/bootstrap-version")" = cmu-manager-bootstrap-03 ] || exit 2
[ "$(cat "$work/package-path")" = "$base" ] || exit 2
if "$io" lock-run "$work/service.lock" /bin/sh -c ':' >/dev/null 2>&1; then
 # Prevent the HTTP process and its journal descendants from retaining the bootstrap lock.
 fd=${CMU_IO_LOCK_FD:-}
 case "$fd" in ''|*[!0-9]*) exit 2;; esac
 [ "$fd" -ge 3 ] && [ "$fd" -le 1024 ] || exit 2
 (
  eval "exec $fd>&-"
  unset CMU_IO_LOCK_FD
  exec "$work/cmu-manager" "$work" "$base" 9970 900
 ) > "$work/service.log" 2>&1 &
 pid=$!
 printf '%s\n' "$pid" > "$work/service.pid"
 i=0
 while [ "$i" -lt 10 ];do
  if [ ! -L "$work/client.js" ] && [ -f "$work/client.js" ] && grep -q "process:$pid}" "$work/client.js" && kill -0 "$pid" 2>/dev/null;then break;fi
  sleep 1;i=$((i+1))
 done
 if [ "$i" -ge 10 ]; then
  echo "stop: service failed; see $work/service.log";exit 2
 fi
 echo 'service started: 15 minutes for new actions; accepted work is allowed to finish'
else
 result=$?
 [ "$result" = 75 ] || { echo 'stop: service lock check failed';exit 2; }
 [ -f "$work/client.js" ] && [ ! -L "$work/client.js" ] || exit 2
 echo 'existing service holds this session lock; return to the panel to check connection'
fi
if [ ! -e "$control" ] && [ ! -L "$control" ];then
 mkdir "$control";chown "$(id -u):$(id -g)" "$control";chmod 700 "$control"
 printf 'cmu-manager-control-03\n' > "$control/marker"
 printf '%s\n' "$work" > "$control/work-path.txt"
else
 [ ! -L "$control" ] && [ -d "$control" ] && [ "$(cat "$control/marker")" = cmu-manager-control-03 ] && [ "$(cat "$control/work-path.txt")" = "$work" ] || exit 2
fi
[ ! -L "$control/client.next" ] && [ ! -L "$control/client.js" ] || exit 2
[ ! -e "$control/client.next" ] || { echo 'stop: uncommitted control staging retained';exit 2; }
"$io" stage "$work/client.js" "$control/client.next" "$("$io" sha256 "$work/client.js")"
mv "$control/client.next" "$control/client.js";"$io" sync-dir "$control"
echo 'manager ready: temporary RAM copy only; no persistent startup installed'
echo 'exit the terminal and return to the USB player'
echo "session files: $work"
