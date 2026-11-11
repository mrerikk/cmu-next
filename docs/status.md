# Current status — 2026-11-11

Test vehicle: **Mazda Roadster ND, model year 2016, Japanese market (Japan)**. No other Connect 1 vehicles have been tested; compatibility with them is unverified. Component-specific pending tests below still apply on the test car.

| Area | Evidence | Remaining work |
| --- | --- | --- |
| Own MP3 loader 1.0.0 | Project-authored zero-PCM carrier, ID3 generator, host structural checks and independent decoding. | Test the new loader bytes on the CMU. |
| Design / preview | Temporary retrofit 0.8 and host component tests exist. | Actual Opera rendering and equipment regression. |
| Copy installation / rollback | Portable host transaction/recovery regressions; current 82-target module installed and exactly rolled back on an independent input-file copy; earlier Engine Check 0.2 vehicle report for a RAM copy. | Permanent storage semantics, bounded writes, boot/recovery integration. |
| Manager 0.3.1 | Vehicle reported ready, but panel stayed offline; expected port was not observed. | Actual failure cause still unconfirmed. |
| Manager 0.3.2 | 83 host checks recorded; vehicle first startup failed. A process-group-leader detach failure is reproduced on the host. | Read vehicle startup diagnostics, implement robust daemon lifetime, verify on CMU. |
| Manager 0.3.3 candidate | Fork-before-setsid launch; actual child PID; five real-process host regressions pass. | Build and test the candidate on CMU; native root cause and UI connection remain unconfirmed. |
| Visual module on vehicle | Earlier visual feedback exists; latest 0.8 complete equipment coverage is not proven. | Controller, native dialogs, camera, projection and all available settings. |
| Apps / new speedometer | Planned. | Runtime and new speedometer are not implemented. |
| Complex multimedia | Preview/reference work only. | Native radio/player/application redesign remains separate. |

A blank service.log from 0.3.1 cannot establish its termination cause because that version did not record normal lifecycle events. A missing control directory after 0.3.2 startup failure is expected: publication occurs only after the service starts. The standalone `diagnose.sh` handles that earlier failure stage.

Host evidence summaries are retained in `docs/evidence`. Original raw vehicle reports and personal workstation paths are excluded. Historical tests are not represented as new tests of this publication.
