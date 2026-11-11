# Known issues

## Manager startup and connection

- 0.3.1 does not isolate the service from the launching terminal process group. Host terminal-group SIGTERM can stop the listener after readiness.
- 0.3.2 attempts `setsid()` directly. When the service is already a process-group leader but not a session leader, this fails with `Operation not permitted`. The host reproduction is in `docs/evidence/manager-group-leader-failure.json`; the same cause on the vehicle is not yet established.
- 0.3.2 `check.sh` assumes the control directory was published; it is insufficient for a failed first startup. Use the independent startup diagnostic script.
- Candidate 0.3.3 adds a fork-before-setsid launch path, publishes the actual service PID under its service lock, and updates the session readiness check. Five real-process host regressions pass, including full session publication and resume. CMU validation remains pending.
- The exact CMU startup cause and browser connection path remain unverified. Do not claim that a host-only fix resolves the vehicle issue.
- One accelerated host integration run encountered ECONNRESET under concurrent test load; a subsequent isolated run passed. The cause of the initial reset was not established; see the evidence note.

## Interrupted preparation

The pre-0.3.4 coordinator could leave a visible `tNNNNNN` directory with no committed phase if interrupted while preparing backups. Manager recovery enumerated that incomplete directory and failed, although no module destination had yet been changed. A real-process host fault reproduction confirmed this (`recover` job failed with exit 2).

Candidate 0.3.4 prepares in `.staging-tNNNNNN`, syncs the complete prepared journal and atomically publishes it as `tNNNNNN` before any destination mutation. Early interrupted staging is retained for inspection and consumes temporary space; it is neither installed nor offered as a rollback transaction. Recovery can clear the failed job and a later installation uses a fresh transaction ID. This does not silently repair legacy incomplete transactions, nor does it prove storage behavior under actual power loss. Use a fresh copy/session; do not migrate an older vehicle RAM workspace into this candidate.

## Product scope

No production permanent installer, persistent manager startup, full firmware backup, custom app runtime, or new speedometer is provided. Radio/player prototypes are not native multimedia replacements. Other firmware and equipment combinations are not automatically supported.
