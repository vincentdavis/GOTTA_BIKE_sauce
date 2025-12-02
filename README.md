# HR Zone Monitor - Sauce4Zwift Mod

A Sauce4Zwift mod that displays nearby riders with their heart rate, color-coded by HR zone based on configurable max HR values.

## Features

- Live display of nearby riders showing name and current heart rate
- Color-coded HR backgrounds based on percentage of max HR (5 zones)
- Click on any rider to quickly set their max HR
- Persistent storage - max HR data survives app restarts
- Configurable settings (font size, max riders displayed, etc.)

## HR Zone Colors

| Zone | % of Max HR | Color | Description |
|------|-------------|-------|-------------|
| 1 | <60% | Gray | Recovery |
| 2 | 60-70% | Blue | Endurance |
| 3 | 70-80% | Green | Tempo |
| 4 | 80-90% | Yellow | Threshold |
| 5 | 90%+ | Red | VO2 Max |

Riders without a configured max HR will display their HR without color coding.

## Installation

### Prerequisites

- [Sauce4Zwift](https://www.sauce.llc/products/sauce4zwift/) installed and running

### Steps

1. **Download the mod**
   - Clone or download this repository to your computer

2. **Open Sauce4Zwift**
   - Launch the Sauce4Zwift application

3. **Access Mod Settings**
   - Click the Sauce4Zwift icon in your system tray/menu bar
   - Select "Settings" or press the settings gear icon
   - Navigate to the "Mods" section

4. **Add the Mod**
   - Click "Add Mod" or "Install Mod"
   - Browse to and select the `s4z_mode_gotta_bike` folder (the folder containing `manifest.json`)
   - Click "Open" or "Select Folder"

5. **Enable the Mod**
   - Find "HR Zone Monitor" in your mod list
   - Toggle it ON to enable

6. **Open the Window**
   - Go to Windows menu in Sauce4Zwift
   - Select "HR Zone Monitor" to open the overlay

## Usage

### Main Display

- Shows nearby riders with their current heart rate
- Riders with configured max HR will have color-coded backgrounds
- Click any rider row to set or update their max HR
- The currently watched rider is highlighted with a blue tint

### Settings

Click the gear icon in the HR Zone Monitor window to access settings:

- **Font scaling**: Adjust text size
- **Max riders to show**: Limit how many riders appear in the list
- **Show only riders with HR**: Hide riders without heart rate monitors
- **Rider Max HR Configuration**: View, edit, or remove configured riders

### Adding Max HR for Riders

**Method 1 - Click to Add (Recommended)**
1. During a ride, click on any rider row in the HR Zone Monitor
2. Enter their max HR in the dialog
3. Click Save

**Method 2 - Manual Entry**
1. Open Settings (gear icon)
2. Scroll to "Rider Max HR Configuration"
3. Enter the rider's name (optional), Athlete ID, and Max HR
4. Click Add

## Finding Athlete IDs

Athlete IDs are automatically captured when you click on a rider in the main display. For manual entry, you can find athlete IDs in:
- Zwift Companion app
- ZwiftPower profiles
- Other Sauce4Zwift windows (hover over rider names)

## Troubleshooting

**Mod not appearing in Sauce4Zwift:**
- Ensure you selected the correct folder containing `manifest.json`
- Restart Sauce4Zwift

**HR not showing for some riders:**
- The rider may not have a heart rate monitor connected
- Enable "Show only riders with HR" in settings to filter these out

**Colors not appearing:**
- Make sure you've set a max HR for that rider
- Click on the rider row to add their max HR

## License

See LICENSE.txt for details.

## Author

Vincent Davis - [gotts.bike](https://gotts.bike)
