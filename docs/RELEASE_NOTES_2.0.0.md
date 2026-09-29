# Chris SoundPad 2.0.0

Targeted audio for **Foundry VTT v14**, with saved sound pads, recipient groups and one volume
control. Regular Foundry playlists and source sound documents remain unchanged.

## Features

- Native v14 application and audio APIs, with opening buttons in the left toolbar and Playlists sidebar.
- Named sound pads and recipient groups saved per GM and world.
- Search, categories, favorites, aliases, sorting and per-sound repeat/fade settings.
- One volume slider with separate Apply to playback and Save as sound default actions.
- Local preview, recipient-specific Stop and an emergency stop for module audio.
- Playback feedback, cancellation of outdated commands and personal player volume/mute.
- English/German interface and the existing macro API. No additional module dependencies.

## Install or update

In Foundry Setup, choose **Add-on Modules > Install Module** and enter:

```text
https://raw.githubusercontent.com/Chrisrous/Chris-Sound-Module/main/module.json
```

Existing installations using this manifest can check for updates. For manual installation,
back up the world and module directory, stop Foundry, and extract `chris-sound-module.zip`
into `Data/modules`. Restart Foundry and reload all connected browsers.

The resulting path must be `Data/modules/chris-sound-module/module.json`.
Stored pads, groups and preferences from RC2 through RC6 are retained. Candidates without an
update URL need a one-time manual update. Version 2.0.0 requires v14. Version 1.1.0 remains
available for v12.

Use `chris-sound-module.zip` for installation, not GitHub's Source code archives.
The `module.json` asset installs this version. `SHA256SUMS` contains checksums for both files.

## Playback controls

Selecting a sound does not start it. The slider prepares the next Play or Preview.
**Apply** changes the current or pending module audio of the displayed recipients.
**Save as sound default** changes only the selected pad entry. Personal player limits still apply.

Status is session-local feedback, not proof of audibility. Multiple tabs may each play audio.
Socket messages are not confidential or server-authenticated by this module. Emergency Stop
cannot reach disconnected clients.

JSON import/export and configurable keyboard shortcuts are planned for a later update.

## Deutsch

Version 2.0.0 ergänzt gespeicherte Pads, Empfängergruppen, Vorschau und Wiedergaberückmeldungen
für Foundry v14. Es gibt genau einen Lautstärkeregler. **Anwenden** verändert die Wiedergabe bei
den angezeigten Empfängern. **Als Standard speichern** verändert nur den gewählten Pad-Eintrag.
Die Auswahl eines anderen Sounds lässt laufende Wiedergabe unverändert.

Vor dem Update Welt und Modulordner sichern. Danach alle Spieler- und Spielleiterfenster neu
laden. Gespeicherte Daten aus RC2 bis RC6 bleiben erhalten.
