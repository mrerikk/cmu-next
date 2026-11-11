# Known issues

## Manager startup and connection

- 0.3.1 does not isolate the service from the launching terminal process group. Host terminal-group SIGTERM can stop the listener after readiness.
- 0.3.2 attempts `setsid()` directly. When the service is already a process-group leader but not a session leader, this fails with `Operation not permitted`. The host reproduction is in `docs/evidence/manager-group-leader-failure.json`; the same cause on the vehicle is not yet established.
- 0.3.2 `check.sh` assumes the control directory was published; it is insufficient for a failed first startup. Use the independent startup diagnostic script.
- Candidate 0.3.3 adds a fork-before-setsid launch path, publishes the actual service PID under its service lock, and updates the session readiness check. Five real-process host regressions pass, including full session publication and resume. CMU validation remains pending.
- The exact CMU startup cause and browser connection path remain unverified. Do not claim that a host-only fix resolves the vehicle issue.
- One accelerated host integration run encountered ECONNRESET under concurrent test load; a subsequent isolated run passed. The cause of the initial reset was not established; see the evidence note.

## Product scope

No production permanent installer, persistent manager startup, full firmware backup, custom app runtime, or new speedometer is provided. Radio/player prototypes are not native multimedia replacements. Other firmware and equipment combinations are not automatically supported.
