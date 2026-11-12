# Current status — 2026-11-12

Test vehicle: **Mazda Roadster ND, model year 2016, Japanese market (Japan)**. No other Connect 1 vehicles have been tested; compatibility with them is unverified. Component-specific pending tests below still apply on the test car.

| Area | Evidence | Remaining work |
| --- | --- | --- |
| Own MP3 loader 1.0.0 | Project-authored zero-PCM carrier, ID3 generator, host structural checks and independent decoding. | Test the new loader bytes on the CMU. |
| Design / preview | Temporary retrofit 0.8, eight public settings regression groups and pinned native-framework host checks (69 factory plus 50 dynamic selections) exist. | Actual Opera rendering and equipment regression. |
| Copy installation / rollback | Portable host transaction/recovery regressions; current 82-target module installed and exactly rolled back on an independent input-file copy; earlier Engine Check 0.2 vehicle report for a RAM copy. | Permanent storage semantics, bounded writes, boot/recovery integration. |
| Manager 0.3.1 | Vehicle reported ready, but panel stayed offline; expected port was not observed. | Actual failure cause still unconfirmed. |
| Manager 0.3.2 | 83 host checks recorded; vehicle first startup failed. A process-group-leader detach failure is reproduced on the host. | Read vehicle startup diagnostics, implement robust daemon lifetime, verify on CMU. |
| Manager 0.3.3 candidate | Fork-before-setsid launch; actual child PID; five launch regressions and four real HTTP/journal/engine workflow regressions pass. | Build and test the candidate on CMU; native root cause and UI connection remain unconfirmed. |
| Manager 0.3.4 candidate | Early preparation fault reproduced and fixed through staged journal publication; 35 host tests pass. | Native startup, USB/mount behavior and hardware/power-loss validation pending. Start a fresh RAM session. |
| Visual module on vehicle | Earlier visual feedback exists; latest 0.8 complete equipment coverage is not proven. | Controller, native dialogs, camera, projection and all available settings. |
| Wi-Fi / SSH test transport | Local connection helper, read-only probe/diagnostics and loopback tunnel; eight offline checks pass. | Verify the existing CMU SSH listener, credentials, host identity, Wi-Fi reachability and forwarding; native automation pending. |
| Apps / new speedometer | Host lifecycle core 0.1: registration, owned resources, input and speed-sample validation; eight synthetic groups pass. | Native bridge, app installation/discovery, real speed source and new speedometer are not implemented. Integration follows verified earlier stages. |
| Complex multimedia | Preview/reference work only. | Native radio/player/application redesign remains separate. |

A blank service.log from 0.3.1 cannot establish its termination cause because that version did not record normal lifecycle events. A missing control directory after 0.3.2 startup failure is expected: publication occurs only after the service starts. The standalone `diagnose.sh` handles that earlier failure stage.

The current operator sequence is [next native run: manager 0.3.4](next-native-run.md). The old 0.3.2 recommendation is superseded. The attempted Wi-Fi/SSH connection did not establish native access; connection helpers remain unverified on CMU.

Host evidence summaries are retained in `docs/evidence`. Original raw vehicle reports and personal workstation paths are excluded. Historical tests are not represented as new tests of this publication.

SSH tools 0.2 provides a stock-daemon check/start helper and an explicit authenticated manager start command. Offline SSH checks pass (15). The inspected firmware copy uses port 36000 and disables password authentication; the public historical cmu/jci default is documented with its limitations. No native SSH connection or daemon-start test has been verified.

SSH tools 0.3 adds an owner-invoked manager smoke controller: authenticated health, explicit fresh RAM-copy checkpoint/install/duplicate/rollback/restore/report cycle, and bounded private summaries. The real host HTTP/engine cycle and refusal tests pass. No native SSH orchestration, live installation or hardware integration is claimed.
