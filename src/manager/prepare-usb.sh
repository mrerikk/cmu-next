#!/bin/sh
# Enable writes only on the verified USB partition that contains this package.
set -u
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
USB=$1
case "$USB" in /mnt/sd[a-d]1|/tmp/mnt/sd[a-d]1) ;;
 *) echo 'USB_PREPARE=refused'; echo 'Unrecognized USB path.'; exit 2;; esac
NAME=${USB##*/}
read_mount() {
 ROW=$(awk -v p="$USB" '$2==p {print $1 " " $3 " " $4; n++} END {if(n!=1)exit 1}' /proc/mounts) || return 1
 set -- $ROW
 [ "$#" -eq 3 ] || return 1
 DEVICE=$1
 TYPE=$2
 OPTIONS=$3
 [ "$DEVICE" = "/dev/$NAME" ] && [ "$TYPE" = 'vfat' ] && [ -b "$DEVICE" ] || return 1
}
if ! read_mount; then echo 'USB_PREPARE=refused'; echo 'USB partition identity or FAT filesystem not confirmed.'; exit 2; fi
case ",$OPTIONS," in
 *,rw,*) echo 'USB_PREPARE=already_rw'; exit 0;;
 *,ro,*) ;;
 *) echo 'USB_PREPARE=refused'; echo 'Unexpected mount options.'; exit 2;;
esac
# Target exactly this mount point. No root or resources partition remount.
if ! mount -o remount,rw "$USB"; then
 echo 'USB_PREPARE=remount_failed'
 echo 'Report will stay in temporary memory.'
 exit 1
fi
if ! read_mount; then echo 'USB_PREPARE=refused'; echo 'USB mount changed during preparation.'; exit 2; fi
case ",$OPTIONS," in
 *,rw,*) echo 'USB_PREPARE=remounted_rw'; exit 0;;
 *) echo 'USB_PREPARE=still_ro'; echo 'Report will stay in temporary memory.'; exit 1;;
esac
