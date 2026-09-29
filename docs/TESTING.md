# Testing and release gate

## Automated checks

```sh
npm run validate
npm run package
```

Node.js 22+ and Python 3 are enough. Test discovery is explicit and does not depend on shell
globs. Static checks cover syntax, case-sensitive imports, manifest assets, locale keys,
template block/action wiring, the one-slider contract, current documentation links and pinned
CI actions. Package verification byte-compares every included file and checks ZIP integrity.

Tests cover core playback/persistence, launchers, recipients, playback scopes, transport,
prepared volume and release metadata. They use API/DOM doubles and simulated client delivery.
A native-browser harness does not establish actual Foundry/Handlebars or WebAudio behavior.
Do not describe these automated checks as actual multi-client Foundry tests.

## Owner acceptance of 2.0.0

On 2026-09-29 the repository owner reported successful RC6 testing and explicitly approved
publication. Accepted candidate commit: `34063940bf4a3468693c453d071af1cddfbdfdbd`.
This is owner-reported acceptance, not an assistant-run Foundry test. The exact Foundry build,
game-system version, browser version and individual case results were not supplied.
The manifest therefore records verified generation **14**, not a fabricated exact build.

The acceptance record and runtime SHA-256 inventory are in `.github/release-approval.json`.
Static validation checks the approved inventory. The publication workflow additionally compares
all runtime directories against the exact accepted commit. Metadata and documentation may differ.

## Real-world regression checklist

Record the exact Foundry build, game system, browsers, module versions and results for future
changes. Use a backed-up world, a GM and two distinct player sessions. The retained checklist
is not marked with invented individual results for the owner's aggregate acceptance.

- [ ] Installation and opening from both launchers, settings and macro without errors.
- [ ] Existing pads/groups/defaults survive upgrades and browser restarts.
- [ ] Exactly one volume slider, including with Sound edit open.
- [ ] A plays for player 1. Selecting B and moving the slider leaves A unchanged and labelled A.
- [ ] Play/Preview use the prepared level. Apply affects only the displayed recipients.
- [ ] Save default affects the selected pad entry, not running audio or the source playlist.
- [ ] Editor Save/Cancel does not override an explicitly saved volume default.
- [ ] Mouse, label and Space recipient changes retain focus and other selections.
- [ ] Changed recipients during a slider gesture cancel it without silent retargeting.
- [ ] Recipient Stop, Preview Stop and Emergency Stop have distinct documented scopes.
- [ ] Loading/unlock, missing files, offline users, multiple tabs, partial groups and mute.
- [ ] Both languages, normal/small windows and the supported UI themes remain usable.

## Packaging and publishing

`tools/package.py` allowlists documentation and runtime directories. It excludes tests, tools,
archive notes and generated logs. Repeated builds with the same source/toolchain are reproducible.
Normal PR/main validation remains read-only and retains a temporary ZIP/checksum build artifact.

The separate `Publish Chris SoundPad 2.0.0` workflow only runs on `release/2.0.0`, by a push or
manual dispatch on that exact branch in this repository. It first runs full validation on
Linux and Windows. Only the publication job receives repository `contents: write` permission.

The publication job builds `chris-sound-module.zip`, `module.json` and `SHA256SUMS`, creates a
draft release at the workflow commit, and uploads these assets. It downloads and byte-compares
them with the validated build before publishing. After publication it repeats the downloads
without authentication and verifies bytes and checksums. Existing releases are never clobbered.
The workflow does not merge PRs, change branch protections or move `main`.

Promotion sequence: finalize the accepted metadata, pass PR validation, create the explicit
release branch at that commit, and verify publication and public assets. Only then merge the PR
to expose the matching stable main manifest. A version-pinned manifest asset is also provided.
If a draft was left by an interrupted publication, inspect it before retrying. The workflow
intentionally refuses to overwrite an existing release rather than guessing whether it is safe.

The existing v1.1.0 release is retained. Version 2.0.0 requires Foundry generation 14.
RC2-RC6 stored pads, groups and preferences require no conversion. Reload all clients on upgrade.
For rollback, restore the previous module directory and reload clients. Keep world backups.

Packaging regressions also run separately with `npm run test:package` (Python unittest).
