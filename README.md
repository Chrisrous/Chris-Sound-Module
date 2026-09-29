# Chris SoundPad

Play sounds for selected players in Foundry VTT without changing ordinary world playlists.

**Version 2.0.0 | Foundry v14 | MIT**

## Install

In Foundry Setup, open **Add-on Modules > Install Module** and paste this manifest URL:

```text
https://raw.githubusercontent.com/Chrisrous/Chris-Sound-Module/main/module.json
```

Enable **Chris SoundPad** in your world and reload all connected browsers. Existing installations
using this manifest can use **Update**. For manual installation, back up your world, stop Foundry
and replace `Data/modules/chris-sound-module` with the folder from the release ZIP.

[Download 2.0.0](https://github.com/Chrisrous/Chris-Sound-Module/releases/tag/v2.0.0)

Version 2.0.0 requires Foundry v14. Version 1.1.0 remains available for v12.
Stored pads, groups and preferences from RC2 through RC6 need no conversion. Candidates without
an update URL need a one-time manual update. Do not delete your world data.

## Use

Open the pad with the headphones button on the left or **Open Chris SoundPad** in the Playlists
sidebar. Drag a playlist sound into a pad, select recipients, choose a sound and press **Play**.
**Preview** plays locally without sending the sound to players.

### One volume control

Selecting a sound loads its saved default into the slider. Adjusting the slider prepares the
**next Play or Preview** and leaves current playback unchanged.

- **Apply to recipient playback** changes the current or pending module audio of the displayed recipients.
- **Save as sound default** stores the value for the selected entry without changing current playback.

Selecting sound B while A plays does not stop, rename or change A. **Stop** affects the displayed
recipient selection. **Clear selection** only removes recipients from the selection.

## Features

Named pads and recipient groups are saved per GM and world. Organize sounds with search,
categories, favorites, aliases and manual ordering. Each sound supports repeat and fade presets.

Separate local preview, per-recipient status, personal player volume/mute and an emergency stop
keep playback under control. Both opening buttons and the existing macro API are available.
The interface is available in English and German. No additional Foundry modules are required.

## Documentation

| Document | Contents |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Setup, playback and troubleshooting |
| [Deutsche Anleitung](docs/USER_GUIDE_DE.md) | Bedienung und Installation |
| [API and macros](docs/API.md) | Methods, return values and examples |
| [Architecture](docs/ARCHITECTURE.md) | Components, state and transport |
| [Testing and releases](docs/TESTING.md) | Tests, packaging and release workflow |
| [Changelog](CHANGELOG.md) | Version history |
| [Contributing](CONTRIBUTING.md) | Development conventions |
| [Security](SECURITY.md) | Transport limits and vulnerability reporting |
| [Version notes](https://github.com/Chrisrous/Chris-Sound-Module/tree/main/docs/archive) | Earlier candidate behavior |

## Development

Node.js 22+ and Python 3 are required. There are no npm dependencies to install.

```sh
npm run validate
npm run package
```

CI runs on Linux and Windows. Package builds include a checksum and exclude development files.
See [Testing and releases](docs/TESTING.md) for the test setup and publishing sequence.
Do not commit generated packages, world data, audio assets or credentials.

## Limitations

Playback status is session-local feedback, not proof that a player can hear the sound. Multiple
browser tabs may each play audio. Module socket messages are not confidential and do not provide
server-authenticated sender identity. See [Security](SECURITY.md).

[MIT License](LICENSE) · Developed by Chrisrous.
