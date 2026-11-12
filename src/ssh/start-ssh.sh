#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# Inspect or start the existing CMU OpenSSH daemon with its existing policy.
set -eu
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
mode=${1:-check}
root=${2:-/}
case "$mode" in check|start) ;; *) echo 'usage: sh start-ssh.sh [check|start] [inspection-root]'; exit 2;; esac
[ "$#" -le 2 ] || exit 2
[ -d "$root" ] && [ ! -L "$root" ] || exit 2
root=$(CDPATH= cd -P "$root" && pwd)
# A supplied firmware copy can only be inspected, never executed.
[ "$mode" = check ] || [ "$root" = / ] || { echo 'error: start requires the live root'; exit 2; }
prefix=${root%/}
config=$prefix/etc/ssh/sshd_config
[ -f "$config" ] && [ ! -L "$config" ] || { echo 'error: stock /etc/ssh/sshd_config unavailable'; exit 2; }
[ -x "$prefix/usr/sbin/sshd" ] || { echo 'error: stock sshd unavailable'; exit 2; }
echo 'cmu-ssh-service=0.1'
echo 'policy=existing-configuration-and-credentials-unchanged'
# Report only public policy fields, never private host keys, password hashes or authorized_keys.
awk '!/^[ \t]*#/ {k=tolower($1); if(k=="port"||k=="listenaddress"||k=="passwordauthentication"||k=="pubkeyauthentication"||k=="permitrootlogin"||k=="permitemptypasswords") print "stock-policy: " $0}' "$config"
ports=$(awk '!/^[ \t]*#/&&tolower($1)=="port" {print $2; found=1} END{if(!found)print 22}' "$config")
for port in $ports; do
 case "$port" in ''|*[!0-9]*) echo 'error: cannot determine stock port'; exit 2;; esac
 [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || exit 2
 echo "configured-port=$port"
done
if [ -f "$prefix/etc/passwd" ]; then
 awk -F: '$3==0 {print "root-login-name=" $1}' "$prefix/etc/passwd"
fi
if [ "$root" != / ]; then
 echo 'inspection=copy-only; live listener not inspected'
 exit 0
fi
[ "$(uname -s)" = Linux ] && [ "$(id -u)" = 0 ] || { echo 'error: live check/start requires the CMU root terminal'; exit 2; }
[ -d /jci ] || { echo 'error: CMU layout unavailable'; exit 2; }
command -v netstat >/dev/null || { echo 'error: netstat unavailable; listener status unknown'; exit 2; }
listeners=$(netstat -lnt) || { echo 'error: cannot inspect listeners'; exit 2; }
occupied=0
for port in $ports; do
 if printf '%s\n' "$listeners" | awk -v p="$port" '$1~/^tcp/&&$4~(":"p"$")&&$6=="LISTEN"{found=1}END{exit !found}'; then
  echo "listener-present=$port (identity and remote reachability not established)"
  occupied=1
 else
  echo "listener-absent=$port"
 fi
done
[ "$mode" = start ] || exit 0
if [ "$occupied" = 1 ]; then
 echo 'start-skipped=existing-listener; no restart performed'
 exit 0
fi
/usr/sbin/sshd -t -f "$config" || { echo 'error: stock SSH configuration or host-key validation failed'; exit 2; }
/usr/sbin/sshd -f "$config" || { echo 'error: stock sshd start failed'; exit 2; }
listeners=$(netstat -lnt) || exit 2
for port in $ports; do
 printf '%s\n' "$listeners" | awk -v p="$port" '$1~/^tcp/&&$4~(":"p"$")&&$6=="LISTEN"{found=1}END{exit !found}' || { echo "error: no listener observed on $port after start"; exit 2; }
done
echo 'stock-sshd-listener=observed; login and Wi-Fi reachability still require verification'
