# Releases and downloads

Use [GitHub Releases](https://github.com/mrerikk/cmu-next/releases) for versioned downloads. Each meaningful component version gets its own release, changes, validation status, installation scope and SHA-256 checksums. Versions identify components, not an interchangeable whole-car firmware.

## Choosing a download

- Retrofit USB packages are temporary visual experiments. Use the package for the intended version and read its instructions before copying its contents to a USB drive.
- Loader packages provide the project-authored MP3 entry files; they do not by themselves start a privileged backend.
- Manager and SSH development candidates remain prereleases until their documented native checks pass. Host tests do not establish vehicle compatibility.
- Public source archives exclude OEM firmware and the private OEM index used in local test bundles.

Testing targets a Mazda Roadster ND 2016, Japanese market, with CMU 74.00.324A EU. Other Connect 1 vehicles have not been tested. A prerelease label is deliberate and does not mean an installer is ready for every car.

## Publication policy

Release notes state the component version, concrete changes, known limitations, test evidence, source and download contents. Assets include checksums; subsequent fixes get a new version instead of silently replacing a published package.

Historical milestones are republished on the actual reissue date, with their original version and historical status explicit. Original Git history and publication dates are retained. GPL reissues carry the grant effective 2026-11-12 and replace the superseded legacy MP3 carrier with the project-authored loader. This does not establish rights to OEM or other third-party material.

The original snapshot and loader releases are historical records. Prefer the explicitly named GPL reissues and current release notes over superseded attachments.

## Published milestones

| Component | Release | Download scope |
| --- | --- | --- |
| Retrofit 0.6.2 | [Accepted selection baseline](https://github.com/mrerikk/cmu-next/releases/tag/retrofit-0.6.2) | Temporary USB package, corresponding source, checksums |
| Retrofit 0.7 | [Visual milestone](https://github.com/mrerikk/cmu-next/releases/tag/retrofit-0.7) | Temporary USB package, corresponding source, checksums |
| Retrofit 0.7.1 | [Intermediate refinement](https://github.com/mrerikk/cmu-next/releases/tag/retrofit-0.7.1) | Temporary USB package, corresponding source, checksums |
| Retrofit 0.8 | [Equipment-driven categories](https://github.com/mrerikk/cmu-next/releases/tag/retrofit-0.8) | Temporary USB package, corresponding source, checksums |
| Manager 0.3.3 | [Forked-launch candidate](https://github.com/mrerikk/cmu-next/releases/tag/manager-0.3.3) | Source-only engineering candidate |
| Manager 0.3.4 | [Transaction-publication candidate](https://github.com/mrerikk/cmu-next/releases/tag/manager-0.3.4) | Source-only engineering candidate |
| SSH tools 0.1.1 | [Connection preparation](https://github.com/mrerikk/cmu-next/releases/tag/ssh-tools-0.1.1) | Source and offline test evidence |
| Application lifecycle core 0.1 | [Host-only foundation](https://github.com/mrerikk/cmu-next/releases/tag/apps-runtime-0.1) | Source; no native bridge or working speedometer |
| GPL reissue | [All reissued packages](https://github.com/mrerikk/cmu-next/releases/tag/gpl-2026-11-12) | Current and historical source, own loader and four USB packages |

All entries above are prereleases. The original snapshot and loader releases retain their attachments and carry a prominent superseded-download/GPL-grant notice.

SSH tools 0.2 adds the stock SSH service helper, explicit port selection and authenticated manager bootstrap. See [SSH tools 0.2](https://github.com/mrerikk/cmu-next/releases/tag/ssh-tools-0.2). Native validation is pending.

## Maintainer workflow

The `Versioned releases` GitHub Actions workflow validates source, reconstructs preserved runtimes and publishes the explicit batch described in `.github/release-plan.json`. It runs when that plan changes on `main`, or when manually dispatched. Routine source commits do not create meaningless releases. Only the publication job receives repository contents write permission; the check job remains read-only.

`tools/publish-releases.py` verifies each uploaded asset against GitHub's SHA-256 digest and stores a publication record as a workflow artifact. A repeated run never overwrites differing published bytes: make a new version when package contents change. The current script publishes the curated historical batch and source candidates listed above; support for a new component/version must be added explicitly before updating the plan.
