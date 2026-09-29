# Changelog

Stable versions have public GitHub releases. Historical candidate records remain in `docs/archive/`.

## Unreleased

### Documentation
- Simplify project guides, historical notes and release descriptions.
- Keep documentation focused on features, usage, compatibility and technical limitations.

## 2.0.0 - 2026-09-29

### Features
- Native Foundry v14 application and audio APIs.
- Persistent pads and recipient groups, local preview, playback feedback and fade presets.
- Left-toolbar and Playlists launchers with a shared window.
- A single volume control with separate Apply and Save default actions.
- Recipient selection that preserves keyboard focus and unsaved edits.
- English/German guides, organized source files and Linux/Windows CI.

### Compatibility and distribution
- Foundry v14 only. Version 1.1.0 remains available for v12.
- Runtime scripts, templates, styles and translations are unchanged from RC6.
- Stable installation manifest, versioned ZIP and SHA-256 checksums.
- Release-branch publishing with draft-asset and public-download verification.
- Technical module ID, schema 1, settings keys and protocol 2 remain unchanged.

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
- Previous published version targeting Foundry v12. Retained as the v1.1.0 GitHub release.
