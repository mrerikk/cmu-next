# Contributing

Start with current status and known issues. Keep changes scoped to a component and preserve native equipment/state logic.

- Use lowercase paths for new project files and lowercase commands for the CMU keyboard workflow. Preserve exact OEM path case when interacting with existing files.
- Never add complete firmware, rootfs extracts, vehicle backups, connection tokens or raw personal reports.
- Identify host fixtures and real vehicle evidence separately. Include exact scope and remaining limitations in test claims.
- Do not automatically repeat a mutation after a lost response. Preserve transaction/job history and recovery behavior.
- Describe device/firmware compatibility precisely. No guessed support for other models, regions or firmware.
- Put release notes and developer documentation in English. A source import must not silently rewrite runtime localization or historical hashes.

Run `python3 tools/check-repository.py` and the relevant component checks before proposing a change. Firmware-dependent integration requires a separately supplied local source tree.

## Licensing

Project-authored code and documentation use PolyForm Noncommercial 1.0.0. Contributions must be compatible with these terms; retain third-party notices and identify any material you cannot license on that basis. Commercial reuse requires separate permission from the owner.
