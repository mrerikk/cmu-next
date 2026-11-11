# cmu-next

A Mazda Connect 2-inspired interface retrofit and modular tooling project for **Mazda Connect 1**.

**Development snapshot — not a production-ready permanent installer.** The current manager line has an unresolved startup problem on the test CMU. Host tests do not establish hardware compatibility. Start with [current status](docs/status.md) and [version history](docs/versions.md).

![Connect 2-inspired commander background](design/background.svg)

## Goal

Retain the original Mazda application logic, equipment-dependent options, native actions and hardware integrations while updating typography, icons, selection effects, scrolling and screen layout. The narrower Connect 1 display uses the area to the left of the Connect 2-style right arc.

The agreed sequence is:

1. Shared design system and temporary preview.
2. Modular installation and rollback, first on a firmware copy.
3. First visual module on the vehicle, then other groups.
4. A custom application runtime and a new speedometer.
5. Separate redesign of complex multimedia modules.

## Components

| Component | Location | Actual scope |
| --- | --- | --- |
| Temporary package manager | `src/manager` | Full-screen panel and local HTTP service; operations target a private RAM copy. |
| File-copy engine | `src/engine` | Pinned inputs, transaction journal, installation and rollback on a marked copy. |
| Visual module 0.8 | `src/visual` | Connect 2-inspired layout, equipment-driven settings categories and shared arc/scroll treatment. |
| Read-only preflight | `src/preflight` | Observes expected files, mounts and storage; does not authorize permanent installation. |
| Startup diagnostics | `src/diagnostics` | Reads marked temporary workspaces even if initial service startup failed. |
| Storage / boot research | `src/storage-probe`, `src/boot-hook` | Engineering candidates, not a production boot integration. |
| Historical milestones | `history` | Selected source versions, with status and limitations documented. |

## Compatibility and status

The firmware under investigation is **74.00.324A EU**, on a Connect 1 CMU running Linux 3.0.35 / ARMv7. Other firmware versions and equipment combinations require their own verification.

Engine Check 0.2 produced a consistent vehicle report for operations on a **RAM file copy**. This does not prove permanent storage, boot recovery, actual Opera rendering, camera/CarPlay/Android Auto behavior, or physical power-loss recovery.

Manager 0.3.1 reported `manager ready` on the vehicle, but its UI stayed offline and the expected listener was not observed. Manager 0.3.2 then failed initial startup. A terminal process-group failure was reproduced on the host, including a group-leader case that 0.3.2 does not handle. The exact vehicle failure is still awaiting diagnostics. **Neither version should be advertised as stable.**

The temporary visual overlay lasts 10 minutes. The manager accepts new actions for 15 minutes and allows an accepted job to finish. Their `js/run.js` loaders are separate alternatives and must not be merged.

## Project-authored loader 1.0.0

Current MP3 entry files are generated from our own zero-PCM carrier and ID3 builder. They replace the legacy silence recording used by the first public snapshot. [Loader provenance and limitations](src/loaders/readme.md) are documented; these new bytes still require a CMU run.

## Authorship and rights

`js/run.js` is generated from cmu-next JavaScript sources. Theme graphics were drawn by the project owner; Connect 2 screenshots served as visual references, not copied graphic assets. The bundled Source Sans 3 font retains its separate SIL OFL license. See [provenance and distribution review](docs/provenance.md). MP3 entry files intentionally use ID3/HTML rendering to load local code; use only on owner-authorized equipment.

## Getting started

- [Build and package sources](docs/build.md)
- [Vehicle test procedure](docs/testing.md)
- [Architecture and state boundaries](docs/architecture.md)
- [Known issues](docs/known-issues.md)
- [Roadmap](docs/roadmap.md)
- [Contributing](contributing.md)
- [Licensing and provenance](license.md)

Run the repository checks locally:

```sh
python3 tools/check-repository.py
python3 tools/build-manager.py --host
```

No OEM firmware is downloaded by these commands. The public source import excludes private vehicle logs, backups, complete firmware and the OEM index.html. A local, hash-verified OEM index can be supplied to reconstruct the module payload; see the build guide.

Project-authored code and documentation use [PolyForm Noncommercial 1.0.0](license.md). Commercial use requires separate permission from the owner. This is a source-available project, not an OSI-approved open-source distribution. Third-party materials retain their own terms. All project documentation is in English. Existing runtime UI strings are retained in their original language to avoid changing behavior during the source import. New project paths use lowercase names. This is an independent project and is not affiliated with Mazda.
