# Testing on a CMU

Vehicle testing is conducted only on the owner’s **Mazda Roadster ND, model year 2016, Japanese market (Japan)**. Other Mazda Connect 1 vehicles have not been tested; compatibility is unverified. The installed firmware under investigation is 74.00.324A EU; the car’s market and firmware region are distinct.

Manager 0.3.1 and 0.3.2 had vehicle startup failures. Candidates 0.3.3 and 0.3.4 fix reproduced host failures but have not yet been verified on CMU. Read `known-issues.md` before attempting an engineering run. Public source snapshots are not a finished permanent installer.

For an existing locally prepared manager USB package, the command for a package containing cmu-manager/start.sh is:

```sh
sh /tmp/mnt/sda1/cmu-manager/start.sh
```

Use the actual partition letter for the MP3 loader that worked on the vehicle. A USB keyboard is still required to bootstrap the temporary service. `start.sh` and `check.sh` are shell scripts; they do not establish an SSH connection.

For a failed initial startup, candidates 0.3.3 and 0.3.4 include the independent diagnostic script inside cmu-manager. Run:

```sh
sh /tmp/mnt/sda1/cmu-manager/diagnose.sh
```

Collect the short output before rebooting. The script reads state and known startup log messages without running the server or printing the connection token. `/tmp` evidence disappears at reboot.

After the manager connection actually works, verify initial-copy backup, installation on the RAM copy, rollback, and report export. The combined export creates `report.txt` and `preflight.txt` in the same `cmu-manager-report-N` folder. Keep both files together. Redact personal/device-sensitive information before posting reports publicly.

The separate retrofit overlay must be checked for home layout, selected-row behavior, right-arc scrolling, controller input, native back navigation, dynamic settings, camera, projection, dialogs and return to stock behavior. Perform interactive checks while parked.

Repository checks validate source syntax, publication boundaries and module hashes. They do not emulate firmware or prove real Opera rendering, equipment behavior, persistent writes or power-loss recovery.

## Testing over Wi-Fi / SSH

An existing, owner-authorized SSH connection can carry native checks and access the loopback service through a local tunnel. See [connection preparation and limits](ssh-testing.md). No live CMU SSH run has yet been verified; no server settings or keys are changed by these preparation tools.

## Portable host regression suite

```sh
python3 -m unittest discover -s tests -v
```

The suite builds local C helpers and uses synthetic regular-file firmware fixtures, isolated temporary directories and loopback connections. No OEM firmware, CMU access or third-party Python dependencies are needed. It covers MP3 structure, manager launch/session lifetime, module plan/apply/idempotence/restore, interrupted install and rollback recovery, and refusal of altered backups/payloads/targets or symlink targets. The eight interruption boundaries terminate the coordinator process; they do not simulate storage power loss.

The separate `docs/evidence/visual-module-copy-0.3.3.json` records a host run of the actual 82-target visual module against an independent copy of its two existing firmware inputs. All installed hashes and modes matched; rollback restored file contents and metadata plus the original directory set. Source input hashes and metadata remained unchanged. This was not a full firmware image, native execution, persistent installation or a power-loss test.

## Manager backend workflow regression

`tests/test_manager_workflow.py` runs the real HTTP service, job journal, dispatcher action branches, copy transaction coordinator and native file helper. It submits authenticated requests, polls durable job records and checks the resulting files. Covered workflows are:

- Checkpoint → install → duplicate request → rollback → restore → export report plus preflight attachment, with digest verification and no connection-token disclosure.
- Interrupted installation → failed job → new mutations refused → explicit recovery → original file bytes and metadata restored.
- Service restart → same request key resolves to the original job and transaction, without a second installation.
- Incorrect connection token or reuse of a request key for another action cannot mutate the copy.

The fixture explicitly replaces CMU mount/uptime observations, the USB write-preparation helper and the read-only vehicle preflight collector with host fixtures. The module and four original inputs are synthetic; no OEM content is shipped in the test. This verifies backend orchestration, not native USB mounts, actual CMU preflight, Opera rendering, vehicle controls, persistent storage or the browser UI. The distinction must be preserved when reporting results.

## Settings / equipment compatibility regressions

The public synthetic fixture `tests/test_settings_categories.cjs` runs through the Python suite when Node.js is available. Eight groups cover 1/5/12/32-category lists, native option-data identity, disabled items, input locks, replaced/reordered arrays and stale clicks, content/root Back behavior, voice/dialog fallback, localization and wrapper cleanup. It contains no OEM sources and does not substitute for tests using the actual native framework.

For the pinned factory framework contract, supply a separately owned, trusted extracted 74.00.324A EU root filesystem and a new output filename:

```sh
node tools/test-settings-framework.cjs /path/to/rootfs build/settings-framework.json
```

This opt-in test checks SHA-256 pins for seven OEM JavaScript inputs before evaluating them with constructed DOM/state/service fixtures. The files are read locally and are not bundled or downloaded. The harness uses actual TabsCtrl, Common, GuiFramework and Multicontroller methods plus nine original settings configurations across system/vehicle/audio settings. It verifies 69 original selections and another 50 selections in 1/5/12/32-category variations through those same methods, while preserving native option data and callbacks. It checks that the module embeds the exact adapter source under test.

The recorded run is [settings framework host evidence](evidence/settings-framework-host.json). It covers these constructed control states, not full firmware initialization, real MMUI context/history responses, actual hardware equipment, camera/projection integration or Opera rendering. It therefore does not establish compatibility with other Connect 1 vehicles. Device testing remains limited to the owner's Roadster ND 2016 Japan, and this latest native test pass is still pending on that vehicle.

## Early preparation crash regression (0.3.4)

The coordinator now stages its complete prepared journal outside the active `tNNNNNN` namespace and publishes it before destination writes. Host tests terminate the coordinator at `preparing`, `staged-payload:1`, `staged-payload:2` and `staged-prepared`. Each leaves the rootfs copy unchanged and no active transaction. Retained staging is not deleted automatically. A new install gets a fresh ID, succeeds, and restores exactly. The real HTTP/journal workflow also verifies recovery after an early failed install followed by a successful new install. Previously that recovery job failed with code 2.

This is process-crash testing on the host, not CMU power-loss qualification. Existing incomplete legacy transactions are not automatically migrated. Candidate 0.3.4 uses separate RAM version markers and requires a fresh CMU boot before replacing another candidate. Report format `cmu-manager-report=0.3.1` remains compatible; the separate `manager-version=0.3.4` field identifies the new candidate.
