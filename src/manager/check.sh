#!/bin/sh
# Read-only, bounded console diagnostics. Does not print auth or client.js.
set -eu
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
stop(){ echo "check: $*";exit 2; }
plain(){ [ ! -L "$1" ] && [ -f "$1" ] && [ "$(stat -c '%h' "$1")" = 1 ]; }
control=/tmp/cmu-next-control
echo 'manager check 0.3.4'
[ ! -L "$control" ] && [ -d "$control" ] || stop 'control directory unavailable'
[ "$(stat -c '%a %u %g' "$control")" = "700 $(id -u) $(id -g)" ] || stop 'control identity refused'
plain "$control/marker" && [ "$(cat "$control/marker")" = cmu-manager-control-034 ] || stop 'different session; finish work and reboot CMU before changing versions'
plain "$control/work-path.txt" || stop 'work pointer unavailable'
work=$(cat "$control/work-path.txt")
case "$work" in *[!a-zA-Z0-9_./-]*) stop 'work pointer refused';; esac
[ "${work%/*}" = "$(CDPATH= cd -P /tmp && pwd)" ] || stop 'work parent refused'
case "${work##*/}" in cmu-manager.*) ;; *) stop 'work name refused';; esac
[ ! -L "$work" ] && [ -d "$work" ] && [ "$(CDPATH= cd -P "$work" && pwd)" = "$work" ] || stop 'work identity refused'
[ "$(stat -c '%a %u %g' "$work")" = "700 $(id -u) $(id -g)" ] || stop 'work permissions refused'
plain "$work/cmu-io" && [ "$(md5sum "$work/cmu-io" | awk '{print $1}')" = '@@io-md5@@' ] || stop 'helper checksum refused'
"$work/cmu-io" check "$work/cmu-io" '@@io-sha@@'
plain "$work/cmu-manager" || stop 'server unavailable'
"$work/cmu-io" check "$work/cmu-manager" '@@server-sha@@'
plain "$work/service.pid" || stop 'service pid unavailable'
pid=$(cat "$work/service.pid")
case "$pid" in ''|*[!0-9]*) stop 'service pid refused';; esac
[ "$pid" -gt 1 ] || stop 'service pid refused'
if kill -0 "$pid" 2>/dev/null;then echo 'process: present (pid alone does not prove service identity)';else echo 'process: absent';fi
if "$work/cmu-manager" --check "$work" 9970;then echo 'connection: ok';else echo 'connection: unavailable';fi
if plain "$work/service.log";then
 echo 'lifecycle (last 6 events):'
 grep '^manager event=' "$work/service.log" | tail -n 6 || :
fi
echo 'check complete; no files changed'
