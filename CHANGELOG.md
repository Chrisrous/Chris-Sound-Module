# Changelog

Candidates are not stable releases. Historical implementation records are in `docs/archive/`.

## 2.0.0-rc.6

### Changed
- One volume control for next Play/Preview. Applying to current recipient audio and saving a
  selected sound's default are separate explicit actions. Remove the duplicate editor slider.
- Loading another sound's default never changes ongoing audio or stored presets.
- Readable UI source, an isolated volume model, purpose-named regression tests and current docs.
- Archive earlier RC development records. Exclude archives and developer files from module ZIPs.
- Add contributor/security guidance, issue/PR templates, editor/Git conventions, cross-platform
  test discovery and expanded static/package validation.
- Pin CI action revisions, test on Linux/Windows and retain installable build artifacts. No auto-release.

## 2.0.0-rc.5
- Fix recipient checkbox focus/state loss, use an explicit inline picker and add Clear selection.

## 2.0.0-rc.4
- Introduce Chris SoundPad branding, the left launcher and on-demand editing.
- Distinguish selected sound, local preview and reported recipient playback.

## 2.0.0-rc.3
- Add the visible Playlists/sidebar-popout launcher and singleton window reveal.

## 2.0.0-rc.2
- Add persistent pads, groups, recipient feedback, fades, preview, sound organization,
  emergency stop, per-entry presets and personal player volume/mute.

## 2.0.0-rc.1
- Migrate the v12 module to Foundry v14 ApplicationV2 and audio APIs.
- Preserve legacy macros, add cancellation guards, localization, tests and packaging.

## 1.1.0
- Previous published version targeting Foundry v12. Kept on the existing stable channel.
