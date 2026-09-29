# Testing and releases

## Automated checks

Node.js 22+ and Python 3 are required.

```sh
npm run validate
npm run package
```

`validate` runs JavaScript syntax and import checks, localization and template checks,
unit tests and Python packaging tests. `package` builds the installation ZIP and checksum.
Run packaging tests separately with `npm run test:package`.

Tests cover playback, cancellation, storage, launchers, recipients, volume controls, transport
and release metadata. Unit tests use API/DOM doubles and an in-process message relay.
Browser tests with a simulated Foundry environment do not cover actual Foundry rendering,
audio devices or networked GM/player sessions.

## Foundry regression checklist

Use a backed-up world with one GM and two separate player sessions. Record the Foundry build,
game system, browsers and active modules with the results.

- [ ] Both opening buttons, settings and macros work without import or template errors.
- [ ] Pads, groups and defaults survive an upgrade and browser restart.
- [ ] There is one volume slider, including while editing a sound.
- [ ] A plays for player 1. Selecting B and adjusting the slider leaves A unchanged.
- [ ] Play and Preview use the prepared value. Apply affects only the displayed recipients.
- [ ] Save default changes only the selected pad entry, not current audio or the source playlist.
- [ ] Editor Save/Cancel does not overwrite an explicitly saved volume default.
- [ ] Checkbox, label and Space selection preserve focus, other recipients and unsaved edits.
- [ ] Changing recipients during a slider gesture cancels the gesture without retargeting it.
- [ ] Recipient Stop, Preview Stop and Emergency Stop retain their separate scopes.
- [ ] Loading, blocked audio, missing files, offline recipients, multiple tabs and mute behave correctly.
- [ ] Both languages and small windows remain usable with the installed interface modules.

## Release configuration

`.github/release-approval.json` contains the release switch, compatibility settings, baseline
commit and runtime SHA-256 inventory. Static checks require the configured version and hashes
to match. The publishing workflow also compares all runtime directories against the baseline
commit. Documentation and package metadata are checked separately.

## Packaging and publishing

`tools/package.py` includes runtime files and selected documentation. Tests, tools, historical
notes and generated logs are excluded. Fixed ZIP metadata makes repeated builds reproducible
with the same source and toolchain. Packaging tests compare every included file with its source
and check internal documentation links.

The version-specific publishing workflow runs on `release/2.0.0`. It validates Linux and Windows,
then builds `chris-sound-module.zip`, `module.json` and `SHA256SUMS`. Only the publishing job has
`contents: write` permission. Normal PR/main CI is read-only.

Assets are uploaded to a draft release, downloaded and byte-compared before publication. Public
downloads are checked again without authentication. The workflow does not merge PRs, move main,
change branch protection or overwrite existing releases.

Publish and verify the assets before merging the matching installation manifest into main.
Inspect an interrupted draft before retrying. Never reuse a version tag for changed package bytes.

Release-description updates are separate from package publishing. They change only the release
body and verify that the tag, target commit and asset checksums remain unchanged.

## Upgrade and rollback

Version 2.0.0 requires Foundry v14. Stored data from RC2 through RC6 needs no conversion.
Reload all clients after upgrading. To roll back, restore the previous module directory and
reload clients. Keep world backups.
