# cmu-next

A Mazda Connect 2-inspired interface retrofit and modular tooling project for **Mazda Connect 1**.

**Development snapshot — not a production-ready permanent installer.** The current manager line has an unresolved startup problem on the test CMU. Host tests do not establish hardware compatibility. Start with [current status](docs/status.md) and [version history](docs/versions.md).

## Downloads

[All releases and version history](https://github.com/mrerikk/cmu-next/releases) · [Retrofit 0.8 — temporary USB package](https://github.com/mrerikk/cmu-next/releases/tag/retrofit-0.8) · [Manager 0.3.4 — source candidate](https://github.com/mrerikk/cmu-next/releases/tag/manager-0.3.4)

Each release includes English notes, validation status, source and SHA-256 checksums. Current packages are engineering prereleases. GPL reissues use our own MP3 loader; its new bytes still require a CMU run. Public manager releases are source-only and require a separately supplied OEM index for a local test bundle.

## Interface preview

![cmu-next home screen — browser design preview](design/preview-home.png)

<details>
<summary>Settings screen</summary>

![cmu-next settings screen — browser design preview](design/preview-settings.png)

</details>

[Interactive HTML preview](preview/demo.html) · [Preview instructions](preview/readme.md)

Browser design preview with simulated data, adapted from the interactive 0.7 design study. It does not run CMU firmware and is not proof of vehicle compatibility. To interact locally, download or clone the repository and open `preview/demo.html` in a browser. GitHub displays HTML source rather than running it inside this README.

## Goal

Retain the original Mazda application logic, equipment-dependent options, native actions and hardware integrations while updating typography, icons, selection effects, scrolling and screen layout. The narrower Connect 1 display uses the area to the left of the Connect 2-style right arc.

The agreed sequence is:

1. Shared design system and temporary preview.
2. Modular installation and rollback, first on a firmware copy.
3. First visual module on the vehicle, then other groups.
4. A custom application runtime and a new speedometer.
5. Separate redesign of complex multimedia modules.
6. Publish significant versions and maintain English documentation and validation evidence on GitHub.

## Components

| Component | Location | Actual scope |
| --- | --- | --- |
| Temporary package manager | `src/manager` | Full-screen panel and local HTTP service; operations target a private RAM copy. |
| File-copy engine | `src/engine` | Pinned inputs, transaction journal, installation and rollback on a marked copy. |
| Visual module 0.8 | `src/visual` | Connect 2-inspired layout, equipment-driven settings categories and shared arc/scroll treatment. |
| Read-only preflight | `src/preflight` | Observes expected files, mounts and storage; does not authorize permanent installation. |
| Startup diagnostics | `src/diagnostics` | Reads marked temporary workspaces even if initial service startup failed. |
| Storage / boot research | `src/storage-probe`, `src/boot-hook` | Engineering candidates, not a production boot integration. |
| Application lifecycle core 0.1 | `src/apps` | Host-only lifecycle foundation; no native bridge, vehicle telemetry source or working speedometer yet. |
| Historical milestones | `history` | Selected source versions, with status and limitations documented. |

## Compatibility and status

**Test vehicle: Mazda Roadster ND, model year 2016, Japanese market (Japan).** Vehicle testing is conducted on this car only. **Other Mazda Connect 1 vehicles have not been tested; compatibility with them is unverified.**

The firmware under investigation on the test CMU is **74.00.324A EU**, running Linux 3.0.35 / ARMv7. The vehicle market and the installed firmware region are separate facts. Other firmware versions and equipment combinations also require their own verification.

Engine Check 0.2 produced a consistent vehicle report for operations on a **RAM file copy**. This does not prove permanent storage, boot recovery, actual Opera rendering, camera/CarPlay/Android Auto behavior, or physical power-loss recovery.

Manager 0.3.1 reported `manager ready` on the vehicle, but its UI stayed offline and the expected listener was not observed. Manager 0.3.2 then failed initial startup. A terminal process-group failure was reproduced on the host, including a group-leader case that 0.3.2 does not handle. The exact vehicle failure is still awaiting diagnostics. Candidate 0.3.3 introduced a fork-before-setsid launcher and actual service PID publication. Current candidate 0.3.4 additionally publishes complete prepared transaction journals atomically; host regressions pass, but it still needs a fresh-session CMU run. **Neither version should be advertised as stable.**

The temporary visual overlay lasts 10 minutes. The manager accepts new actions for 15 minutes and allows an accepted job to finish. Their `js/run.js` loaders are separate alternatives and must not be merged.

## Project-authored loader 1.0.0

Current MP3 entry files are generated from our own zero-PCM carrier and ID3 builder. They replace the legacy silence recording used by the first public snapshot. [Loader provenance and limitations](src/loaders/readme.md) are documented; these new bytes still require a CMU run.

## Authorship and rights

`js/run.js` is generated from cmu-next JavaScript sources. Theme graphics were drawn by the project owner; Connect 2 screenshots served as visual references, not copied graphic assets. The bundled Source Sans 3 font retains its separate SIL OFL license. See [provenance and distribution review](docs/provenance.md). MP3 entry files intentionally use ID3/HTML rendering to load local code; use only on owner-authorized equipment.

## Getting started

- [Build and package sources](docs/build.md)
- [Next native run — manager 0.3.4](docs/next-native-run.md)
- [Vehicle test procedure](docs/testing.md)
- [Wi-Fi / SSH test connection](docs/ssh-testing.md)
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

Project-authored code and documentation use [GNU GPL v3 or later (GPL-3.0-or-later)](license.md). Commercial use and redistribution are permitted under GPL; see [licensing and the grant for earlier versions](docs/licensing.md). Third-party materials retain their own terms. All project documentation is in English. Existing runtime UI strings are retained in their original language to avoid changing behavior during the source import. New project paths use lowercase names. This is an independent project and is not affiliated with Mazda.

See [release and download policy](docs/releases.md) for versioned packages, validation labels and historical GPL reissues.
