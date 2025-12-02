# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **HR Zone Monitor**, a Sauce4Zwift mod that displays nearby riders with heart rate data color-coded by HR zones. Sauce4Zwift is a companion app for Zwift cycling/running platform.

## Development Commands

```bash
npm start    # Start webpack dev server
npm run build  # Production build
```

No test suite is configured.

## Architecture

### Sauce4Zwift Mod Structure

This mod follows the Sauce4Zwift mod pattern:
- `manifest.json` - Mod metadata and window definitions
- `pages/` - Web root containing HTML pages served by Sauce4Zwift

### Key Files

- `pages/hr-zone-monitor.html` - Main overlay window (displays rider table)
- `pages/hr-zone-monitor-settings.html` - Settings window (opened via gear icon)
- `pages/src/hr-zone-monitor.mjs` - All JavaScript logic for both windows
- `pages/css/hr-zone-monitor.css` - Styles for both windows

### Single JS Module Pattern

Both HTML pages import from the same `hr-zone-monitor.mjs` but call different entry points:
- Main window calls `main()`
- Settings window calls `settingsMain()`

### Sauce4Zwift API Integration

The mod uses Sauce4Zwift's `common.mjs` module (imported from `/pages/src/common.mjs`):
- `common.subscribe('groups', callback)` - Subscribes to nearby rider group data
- `common.settingsStore` - Persistent key-value storage with cross-window sync
- `common.initSettingsForm()` - Auto-binds HTML form elements to settings
- Settings keys with leading `/` (e.g., `/hr-zone-monitor-max-hr-data`) are global across windows

### Data Flow

1. Main window subscribes to `'groups'` data containing nearby athletes
2. Rider HR is read from `athlete.state.heartrate`
3. Max HR per athlete stored in settingsStore with key `/hr-zone-monitor-max-hr-data`
4. Settings changes broadcast via `settingsStore.addEventListener('set', ...)` for cross-window sync

### Default Settings

```javascript
{
    fontScale: 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
    maxRiders: 20,
    showOnlyWithHR: true  // Filters to only riders broadcasting HR
}
```