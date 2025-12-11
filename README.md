# GOTTA.BIKE Sauce Mod

A Sauce4Zwift mod with features focused on pre-race strategy planning and live race monitoring.

## Features

### Live Stats Window
- Displays nearby riders with heart rate data color-coded by HR zones
- Shows power data (5s, 15s, 30s, 60s, 5min, 20min)
- Customizable display settings (font scale, max riders, background color)
- Integration with GOTTA.BIKE for detailed athlete data

### PreRace Heatmap Window
- Pre-race analysis heatmap showing event entrants' power data
- 38 customizable columns including:
  - Power (watts and W/kg for various durations)
  - Physical stats (weight, height)
  - Power model data (FTP, CP, AWC)
  - Phenotype scores (sprinter, puncheur, pursuiter, TT, climber)
  - Profile suitability (flat, rolling, hilly, mountain)
  - Race statistics and rankings
- Color-coded cells (green=low threat, red=high threat)
- Click column headers to sort
- Click rider names to view detailed athlete profile
- Profile links to ZwiftPower and Zwift Racing

### Known Athletes Management
- Track and manage athlete data across sessions
- Bulk import from GOTTA.BIKE API
- Search and filter athletes
- Edit individual athlete HR/power data

## Installation

1. Download the latest release ZIP from [Releases](https://github.com/vincentdavis/GOTTA_BIKE_sauce/releases)
2. Extract to your Sauce4Zwift mods folder
3. Enable the mod in Sauce4Zwift settings

## Usage

### Live Stats
- Open "GOTTA.BIKE sauce" from Sauce4Zwift window picker
- Click the gear icon to open settings
- Configure HR zones and display preferences

### PreRace Heatmap
- Open "PreRace Heatmap" from Sauce4Zwift window picker
- Enter an event ID or select from cached events
- Choose a subgroup and click "Import from GOTTA.BIKE"
- Click column headers to sort by any metric
- Click rider names to view full athlete details

## License

MIT License - See LICENSE.txt for details.

## Author

Vincent Davis - [gotta.bike](https://gotta.bike)
