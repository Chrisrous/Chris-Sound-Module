# Testing and release gate

## Automated checks

```sh
npm run validate
npm run package
```

Node.js 22+ and Python 3 are enough. Test discovery is explicit and does not depend on shell
globs. Static checks cover syntax, case-sensitive imports, manifest assets, locale keys,
template block/action wiring, the one-slider contract, active documentation links and pinned
CI actions. Package verification byte-compares every included file and checks ZIP integrity.

The test suites cover core playback/persistence, launcher behavior, recipients, playback scopes,
transport and the new volume model. Tests use API/DOM doubles and simulated client delivery.
A native-browser harness still does not establish actual Foundry/Handlebars or WebAudio behavior.
Do not describe any of these as an actual multi-client Foundry test.

## Required real-world acceptance

Record the exact Foundry build, game system, browser(s), module versions and outcomes.
Use a backed-up test world, a GM and two distinct player sessions.

- [ ] RC6 installs and opens from both launchers, settings and macro; no import/template errors.
- [ ] Existing pads/groups/defaults survive upgrading from RC5 and a browser restart.
- [ ] Exactly one volume slider is present, including with Sound edit open.
- [ ] A plays for player 1. Select B and move the slider: A is unchanged and still labelled A.
- [ ] Play and Preview use the prepared value; Apply changes only the displayed recipients.
- [ ] Save as sound default changes B's saved volume only, not A or the source playlist.
- [ ] Editor Save/Cancel does not override the one slider's explicitly saved default.
- [ ] Mouse, checkbox-label and Space recipient changes retain focus and other selections.
- [ ] Changed recipients during a slider gesture cancel it; a redraw cannot silently retarget.
- [ ] Stop selection, Preview stop and Emergency Stop have their separate documented scopes.
- [ ] Test loading/unlock, failure, offline targets, multiple tabs, group partial failure and mute.
- [ ] Both locales, normal/small windows and supported UI themes keep the control areas usable.

## Packaging and stable promotion

`tools/package.py` uses an allowlist for documentation and runtime directories. It excludes
development tests, tools, archive notes and generated logs. Fixed entry metadata makes repeated
builds with the same source/toolchain reproducible. CI retains the installable ZIP and checksum
as a temporary build artifact. CI does not create GitHub releases or modify branches.

Only after the real-client checklist passes: choose the stable version, synchronize manifests,
set `compatibility.verified` to the tested build, publish a real ZIP asset, and restore the stable
manifest/download URLs. Verify the downloaded artifact before merging/publishing the channel.
Do not point an RC at an old ZIP, nonexistent future asset or untested stable manifest.

For rollback, restore the previous module directory and reload all clients. Keep world backups.

Packaging regressions also run with `npm run test:package` (Python unittest).
