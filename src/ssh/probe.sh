#!/bin/sh
# Read-only SSH transport probe. No firmware writes, services or key changes.
set -eu
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
printf 'cmu-ssh-probe=1\n'
printf 'uid=%s\n' "$(id -u)"
printf 'kernel=%s\n' "$(uname -r)"
printf 'architecture=%s\n' "$(uname -m)"
if [ -f /jci/version.ini ] && [ ! -L /jci/version.ini ];then
 if command -v sha256sum >/dev/null 2>&1;then
  printf 'firmware-version-sha256=%s\n' "$(sha256sum /jci/version.ini | awk '{print $1}')"
 else printf 'firmware-version-sha256=unavailable\n';fi
else printf 'firmware-version-sha256=unavailable\n';fi
if awk '$2=="/tmp" && ($3=="tmpfs" || $3=="ramfs"){ok=1} END{exit !ok}' /proc/mounts 2>/dev/null;then
 printf 'temporary-memory-mount=yes\n'
else printf 'temporary-memory-mount=unconfirmed\n';fi
for name in sda1 sdb1 sdc1 sdd1;do
 if [ -d "/tmp/mnt/$name/cmu-manager" ] && [ ! -L "/tmp/mnt/$name/cmu-manager" ];then printf 'usb-package=%s\n' "$name";fi
done
printf 'probe-complete=yes\n'
