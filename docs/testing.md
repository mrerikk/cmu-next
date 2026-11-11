# Testing on a CMU

Manager 0.3.1 and 0.3.2 had vehicle startup failures. Candidate 0.3.3 fixes a reproduced host launch failure but has not yet been verified on CMU. Read `known-issues.md` before attempting an engineering run. Public source snapshots are not a finished permanent installer.

For an existing locally prepared manager USB package, the command for a package containing cmu-manager/start.sh is:

```sh
sh /tmp/mnt/sda1/cmu-manager/start.sh
```

Use the actual partition letter for the MP3 loader that worked on the vehicle. A USB keyboard is still required to bootstrap the temporary service. `start.sh` and `check.sh` are shell scripts; they do not establish an SSH connection.

For a failed initial startup, candidate 0.3.3 includes the independent diagnostic script inside cmu-manager. Run:

```sh
sh /tmp/mnt/sda1/cmu-manager/diagnose.sh
```

Collect the short output before rebooting. The script reads state and known startup log messages without running the server or printing the connection token. `/tmp` evidence disappears at reboot.

After the manager connection actually works, verify initial-copy backup, installation on the RAM copy, rollback, and report export. The combined export creates `report.txt` and `preflight.txt` in the same `cmu-manager-report-N` folder. Keep both files together. Redact personal/device-sensitive information before posting reports publicly.

The separate retrofit overlay must be checked for home layout, selected-row behavior, right-arc scrolling, controller input, native back navigation, dynamic settings, camera, projection, dialogs and return to stock behavior. Perform interactive checks while parked.

Repository checks validate source syntax, publication boundaries and module hashes. They do not emulate firmware or prove real Opera rendering, equipment behavior, persistent writes or power-loss recovery.

## Portable host regression suite

```sh
python3 -m unittest discover -s tests -v
```

The suite builds local C helpers and uses synthetic regular-file firmware fixtures, isolated temporary directories and loopback connections. No OEM firmware, CMU access or third-party Python dependencies are needed. It covers MP3 structure, manager launch/session lifetime, module plan/apply/idempotence/restore, interrupted install and rollback recovery, and refusal of altered backups/payloads/targets or symlink targets. The eight interruption boundaries terminate the coordinator process; they do not simulate storage power loss.

The separate `docs/evidence/visual-module-copy-0.3.3.json` records a host run of the actual 82-target visual module against an independent copy of its two existing firmware inputs. All installed hashes and modes matched; rollback restored file contents and metadata plus the original directory set. Source input hashes and metadata remained unchanged. This was not a full firmware image, native execution, persistent installation or a power-loss test.
