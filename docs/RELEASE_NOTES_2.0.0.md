# Chris SoundPad 2.0.0

Stable release for **Foundry VTT v14**. Promoted from the owner-tested `2.0.0-rc.6`
candidate without changing its runtime scripts, templates, styles or translations.

## Highlights

- Native v14 application and audio APIs with left-toolbar and Playlists launchers.
- Persistent named sound pads and recipient groups, per GM and world.
- Search, categories, favorites, aliases, sorting and per-sound loop/fade presets.
- One volume slider with explicit Apply to playback and Save as sound default actions.
- Separate local preview, recipient-scoped Stop and emergency Stop for module audio.
- Per-recipient feedback, cancellation of stale playback and personal player volume/mute.
- English/German interface and the existing macro API. No additional module dependencies.

## Install or update

In Foundry Setup, choose **Add-on Modules > Install Module** and enter:

```text
https://raw.githubusercontent.com/Chrisrous/Chris-Sound-Module/main/module.json
```

Existing stable installations using that address can check for updates after the main
manifest is promoted. Manual installation: back up your world/module, stop Foundry,
extract `chris-sound-module.zip` into `Data/modules`, then restart and reload all clients.
The final path must be `Data/modules/chris-sound-module/module.json`.

RC2-RC6 pads, groups and preferences are retained. An RC without a manifest URL may need
one manual update. This release does not support v12/v13. v1.1.0 remains available for v12.
The separate `module.json` asset is the version-pinned installation manifest for this release.
`SHA256SUMS` verifies the module ZIP and manifest. The GitHub Source code archives are not
the curated installation package.

## Acceptance and limits

The owner reported successful RC6 testing and approved publication on 2026-09-29.
Exact Foundry build, game-system/browser versions and individual case logs were not supplied.
Verified generation is therefore 14. Automated tests are supplementary, not an independent
Foundry runtime certification. Release automation checks the accepted runtime file hashes
and verifies downloaded assets against source before and after publication.

Selecting a sound is not starting it. Adjusting the slider prepares the next Play/Preview.
Apply targets the displayed recipients' current/pending audio. Save default changes only
the selected pad entry. Personal player mute and volume limits still apply.

Status is session-local feedback, not proof of audibility or an authoritative global mixer.
Module packets are not confidential or server-authenticated by this module. Multiple tabs
may each play audio. Emergency Stop cannot reach disconnected clients. Regular playlists
and source sound documents remain untouched.

JSON import/export and configurable keybindings remain planned for a later update.

## Deutsch

Erste stabile v14-Version mit gespeicherten Pads, Gruppen, Vorschau, Rückmeldungen und
vereinfachter Bedienung. Es gibt genau einen Lautstärkeregler. **Anwenden** verändert die
Wiedergabe bei den angezeigten Empfängern. **Als Standard speichern** verändert nur den
gewählten Pad-Eintrag. Die Auswahl eines anderen Sounds verändert keine laufende Wiedergabe.

Vor dem Update Welt und Modulordner sichern. Nach dem Update alle Spieler- und
Spielleiterfenster neu laden. Die gespeicherten Daten aus RC2 bis RC6 bleiben erhalten.
