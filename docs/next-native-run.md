# Next native run: manager 0.3.4

This is the current native test sequence, not a claim that the project is complete. The test vehicle is the owner's Mazda Roadster ND, model year 2016, Japanese market. Installed firmware under investigation: 74.00.324A EU. Other Connect 1 vehicles are untested.

## Select one current package

Use the complete `cmu-manager-0.3.4-usb.zip` local test candidate. It already contains the manager UI, service, journal/engine, visual module 0.8 for a RAM copy, preflight collector, diagnostics and project-authored MP3 loader 1.0.0. Do not add old engine-check, preflight or bootstrap files to it. Older 0.3.1/0.3.2/0.3.3 packages remain historical; their observations do not validate this candidate.

Verified archive SHA-256:

```text
a12ada79f94932eede4bf0eaf716cea1754f15ba1d6395e42a2f503ad30aeea2  cmu-manager-0.3.4-usb.zip
```

The test bundle contains a locally reconstructed OEM-derived index and is supplied locally, not as a cleared public firmware download. Public sources and reproducible build instructions are in the repository.

## 1. Establish access, then record the actual transport

For SSH, verify that the laptop and CMU are currently on the same reachable network. Record the address shown by CMU, the known login and a trusted host-key fingerprint. Use the [SSH preparation guide](ssh-testing.md). The previous iPhone-hotspot attempt did not reach an SSH listener; an ARP entry by itself does not identify the CMU or establish a connection. Do not reuse an old address without checking it.

If SSH is unavailable, use the existing USB-keyboard and native-terminal procedure. An SSH login with insufficient privileges cannot replace the root terminal used by this package. The optional stock-daemon helper and the documented historical default credentials are described in the SSH guide. Inspect the actual configuration first; port 36000 occurs in the local firmware copy. Network reconfiguration and legacy algorithm changes are not part of this run.

## 2. Start a fresh candidate session

Finish any existing job, preserve old reports and reboot the CMU before changing manager versions. The RAM markers deliberately prevent 0.3.4 from reusing an earlier candidate's workspace.

Copy the contents of `usb` to the flash-drive root: `cmu-manager`, `js` and `mp3`. Do not copy the enclosing `usb` directory as an extra level. Keep previous reports separately. Do not overwrite this `js/run.js` with the standalone visual-overlay script.

Play the MP3 matching the USB partition that worked previously. **First observation:** does the manager window appear? These are new project-authored MP3 bytes, still awaiting native validation. If the window does not appear, record that separately; it is not evidence about whether the shell service can listen.

Using the root terminal or an already verified authorized root SSH session, run the existing package entry point. For partition sda1:

```sh
sh /tmp/mnt/sda1/cmu-manager/start.sh
```

After a verified root SSH login, the laptop equivalent is `python3 tools/cmu-ssh.py start-manager --partition sda1`, followed by `python3 tools/cmu-ssh.py check --partition sda1`.

Substitute the actual partition letter. The supplied script requires the canonical `/tmp/mnt/sd[a-d]1` package path. It validates the package and creates a private memory-backed workspace. It does not install persistent startup.

**Second observation:** capture the complete short startup output, including either `manager ready` or the exact failure. Return to the USB player and check the manager connection. **Third observation:** record whether the panel actually connects; readiness text alone does not prove UI transport.

For failed startup:

```sh
sh /tmp/mnt/sda1/cmu-manager/diagnose.sh
```

Collect this before rebooting, because the temporary evidence will disappear. Do not publish `auth` or `client.js`. A missing control directory after failed startup is not a separate proof of the root cause.

## 3. Exercise only the marked RAM-copy workflow

Once the panel is connected:

1. Create the initial checkpoint before any installation.
2. Install the supplied visual module into the manager's RAM copy.
3. Confirm that the operation succeeds and appears in installed items/history.
4. Roll the transaction back and confirm success.
5. Exercise checkpoint restoration and confirm success.
6. Export the combined check/report to USB.

This manager does not change the running stock screen when it installs into the copy. Its checkpoint contains four initial inputs, not a full firmware backup. This is expected behavior, not a failed live theme installation. The standalone visual overlay is a separate later rendering/input test.

Do not deliberately remove power, trigger failure hooks or terminate processes during the first native run. Process-crash regression evidence is from host tests; actual power-loss recovery remains unverified.

## 4. Preserve the paired result

Keep `report.txt` and `preflight.txt` from the same newly created `cmu-manager-report-N` directory. The report includes `manager-version=0.3.4`; the older `cmu-manager-report=0.3.1` line identifies the retained report format, not the manager release. A nonzero preflight result may still leave both reports successfully saved. Preserve them and the short terminal output rather than inferring that a write to live firmware is permitted.

Record these outcomes together: MP3 window, startup result, actual panel connection, checkpoint/install/rollback/restore results and report folder. Personal vehicle data, network addresses and raw logs stay local; publish sanitized evidence only.

## What this closes, and what it does not

A successful run would provide native evidence for the temporary manager and RAM-copy actions on this test car. It would not prove persistent storage, a permanent installer, boot recovery, the complete visual retrofit, other equipment/vehicles, the custom application runtime/speedometer or native multimedia replacements. Keep the original six-stage roadmap and verify those separately.
