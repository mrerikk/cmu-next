#!/bin/sh
# Read-only diagnostics for startup before control publication. No executables run.
set -eu
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
plain(){ [ ! -L "$1" ] && [ -f "$1" ] && [ "$(stat -c '%h' "$1")" = 1 ]; }
selected=
for work in /tmp/cmu-manager.*;do
 [ ! -L "$work" ] && [ -d "$work" ] || continue
 case "${work##*/}" in *[!a-z0-9.-]*) continue;; esac
 [ "$(stat -c '%a %u %g' "$work")" = "700 $(id -u) $(id -g)" ] || continue
 plain "$work/marker" && [ "$(cat "$work/marker")" = cmu-manager-ram-01 ] || continue
 plain "$work/bootstrap-version" || continue
 case "$(cat "$work/bootstrap-version")" in cmu-manager-bootstrap-03|cmu-manager-bootstrap-032|cmu-manager-bootstrap-033|cmu-manager-bootstrap-034) ;; *) continue;; esac
 plain "$work/service.log" || continue
 if [ -z "$selected" ] || [ "$work/service.log" -nt "$selected/service.log" ];then selected=$work;fi
done
echo 'manager startup diagnostics'
if [ -z "$selected" ];then echo 'no marked startup workspace found';exit 2;fi
echo "workspace: $selected"
echo "version: $(cat "$selected/bootstrap-version")"
if plain "$selected/service.pid";then
 pid=$(cat "$selected/service.pid")
 case "$pid" in ''|*[!0-9]*) echo 'pid: invalid';; *)
 if [ "$pid" -gt 1 ] && kill -0 "$pid" 2>/dev/null;then echo "pid: $pid present";else echo "pid: $pid absent";fi;; esac
fi
awk 'toupper($2) ~ /:26F2$/ && $4=="0A" {n++} END {if(n)print "port 9970: listening";else print "port 9970: not listening"}' /proc/net/tcp
bytes=$(wc -c < "$selected/service.log")
echo "service log bytes: $bytes"
echo 'last startup events:'
# Never expose arbitrary log text or the client/auth file. Fixed manager messages only.
tail -n 16 "$selected/service.log" | grep -E '^(manager (event=|detach:|stdin:|listen:)|error:)' | tail -n 6 || :
echo 'done; no files changed'
