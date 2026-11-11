# Testing on a CMU

The current manager versions have known startup failures. Read `known-issues.md` before attempting an engineering run. Public source snapshots are not a finished permanent installer.

For an existing locally prepared manager USB package, the historical command is:

```sh
sh /mnt/sda1/cmu-manager/start.sh
```

Use the actual partition letter for the MP3 loader that worked on the vehicle. A USB keyboard is still required to bootstrap the temporary service. `start.sh` and `check.sh` are shell scripts; they do not establish an SSH connection.

For a failed initial startup, place `src/diagnostics/diagnose.sh` in the USB root and run:

```sh
sh /mnt/sda1/diagnose.sh
```

Collect the short output before rebooting. The script reads state and known startup log messages without running the server or printing the connection token. `/tmp` evidence disappears at reboot.

After the manager connection actually works, verify initial-copy backup, installation on the RAM copy, rollback, and report export. The combined export creates `report.txt` and `preflight.txt` in the same `cmu-manager-report-N` folder. Keep both files together. Redact personal/device-sensitive information before posting reports publicly.

The separate retrofit overlay must be checked for home layout, selected-row behavior, right-arc scrolling, controller input, native back navigation, dynamic settings, camera, projection, dialogs and return to stock behavior. Perform interactive checks while parked.

Repository checks validate source syntax, publication boundaries and module hashes. They do not emulate firmware or prove real Opera rendering, equipment behavior, persistent writes or power-loss recovery.
