# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **GOTTA.BIKE Sauce**, a Sauce4Zwift mod with two main features:
1. **Live Stats** - Displays nearby riders with HR zone color-coding and power data
2. **PreRace Heatmap** - Pre-race analysis showing event entrants' power data in a color-coded heatmap

Sauce4Zwift is a companion app for the Zwift cycling/running platform.

## Development Commands

```bash
./local_build.sh  # Creates release ZIP with version from manifest.json
```

No webpack/npm build required - this is a pure HTML/CSS/JS mod.

## Architecture

### Sauce4Zwift Mod Structure

This mod follows the Sauce4Zwift mod pattern:
- `manifest.json` - Mod metadata and window definitions
- `pages/` - Web root containing HTML pages served by Sauce4Zwift

### Key Files

#### Live Stats Window
- `pages/live-stats.html` - Main overlay window
- `pages/live-stats-settings.html` - Settings window (Settings, Help tabs)
- `pages/src/live-stats.mjs` - JavaScript logic (~2700 lines)
- `pages/css/live-stats.css` - Styles

#### PreRace Heatmap Window
- `pages/pre-race.html` - Main overlay window with heatmap
- `pages/pre-race-settings.html` - Settings window (Settings, Known Athletes, GOTTA.BIKE tabs)
- `pages/src/pre-race.mjs` - JavaScript logic (~2100 lines)
- `pages/css/pre-race.css` - Styles including heatmap table, color tiers, rider modal

### Single JS Module Pattern

Both HTML pages import from the same `.mjs` file but call different entry points:
- Main window calls `main()` or `preRaceMain()`
- Settings window calls `settingsMain()` or `preRaceSettingsMain()`

### Sauce4Zwift API Integration

The mod uses Sauce4Zwift's `common.mjs` module (imported from `/pages/src/common.mjs`):
- `common.subscribe('groups', callback)` - Subscribes to nearby rider group data
- `common.settingsStore` - Persistent key-value storage with cross-window sync
- `common.initSettingsForm()` - Auto-binds HTML form elements to settings
- `common.rpc.getCachedEvents()` - Get cached Zwift events
- `common.rpc.getEvent(id)` - Fetch specific event details
- `common.rpc.getEventSubgroupEntrants(id)` - Get event entrant list
- `common.rpc.openExternalLink(url)` - Open URL in system browser
- Settings keys with leading `/` (e.g., `/hr-zone-monitor-athlete-data`) are global across windows

### Data Storage Keys

```javascript
// Athlete data (shared between windows)
'/hr-zone-monitor-athlete-data'  // GOTTA.BIKE imported data
'/hr-zone-monitor-max-hr-data'   // HR values + user-edited name/team
'/hr-zone-monitor-max-power-data' // Power values
'/hr-zone-monitor-gotta-auth'    // GOTTA.BIKE API credentials

// PreRace settings
'pre-race-settings-v1'           // Window-specific settings
```

### PreRace Heatmap Features

- **38 customizable columns** organized by category:
  - info: team (text)
  - power_watts: w5, w15, w30, w60, w120, w300, w1200
  - power_wkg: wkg5-wkg1200
  - power_model: ftp, cp, awc, powerRating, compoundScore
  - physical: weight, height
  - phenotype: sprinter, puncheur, pursuiter, tt, climber scores
  - profile: flat, rolling, hilly, mountain suitability
  - race_stats: finishes, wins, podiums, DNFs
  - race_ranking: current rating, 30-day max, 90-day max

- **Color scale**: 8 tiers from green (low/weak) to red (high/strong threat)
- **Per-column normalization**: Uses min/median/max for each column
- **Sorting**: Click column headers, toggles ascending/descending
- **Rider modal**: Click rider name to view all GOTTA.BIKE data + profile links

### CSS Heatmap Implementation

The heatmap uses pure HTML table + CSS (no external libraries):
- `.heatmap-table` with sticky thead
- 8 color tier classes: `.color-tier-0` (gray/text) through `.color-tier-7` (red)
- Tooltip positioned on cell hover
- Rider detail modal with profile links

### GOTTA.BIKE API Integration

- API URL: `https://app.gotta.bike`
- Bulk endpoint: `/api_v1/zrapp/riders_sauce_mod`
- Auth header: `X-Sauce-API-Key: {api_key}`
- Batch imports in groups of 50 athletes

### Team Name Sources (Priority Order)

1. User-edited: `storedMaxHRData[team_${id}]`
2. GOTTA.BIKE: `storedAthleteData[id].team`
3. Zwift live: `athlete.athlete?.team` (parsed from username)
4. Event entrant: `entrant.team`

### Critical CSS Patterns

**Display override fix**: CSS `display` property overrides `hidden` attribute:
```css
/* WRONG - shows element even with hidden attribute */
#element { display: flex; }

/* CORRECT - only applies display when not hidden */
#element:not([hidden]) { display: flex; }
```

**Settings page titlebar**: Add `class="settings-page"` to `<html>` tag for persistent titlebar visibility.

### Window Configuration

Settings windows don't need manifest entries - opened via `?child-window` query param:
```html
<a href="pre-race-settings.html?width=800&height=700&child-window">Settings</a>
```

## Default Settings

### Live Stats
```javascript
{
    fontScale: 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
    maxRiders: 20,
    showOnlyWithHR: true
}
```

### PreRace
```javascript
{
    fontScale: 1,
    maxRiders: 50,
    backgroundOption: 'transparent',
    customBackgroundColor: '#1a1a1a',
    selectedColumns: ['wkg5', 'wkg15', 'wkg60', 'wkg300', 'w5', 'w15', 'w60', 'w300'],
    defaultSortColumn: 'wkg60',
    defaultSortAscending: false
}
```
