import * as common from '/pages/src/common.mjs';

const doc = document.documentElement;

// Background color presets
const BACKGROUND_OPTIONS = {
    transparent: { name: 'Transparent', color: null },
    sauce: { name: 'Sauce Default', color: '#232323' },
    black: { name: 'Black', color: '#000000' },
    darkGray: { name: 'Dark Gray', color: '#1a1a1a' },
    darkBlue: { name: 'Dark Blue', color: '#0d1b2a' },
    darkGreen: { name: 'Dark Green', color: '#1a2e1a' },
    custom: { name: 'Custom', color: null }  // Uses customBackgroundColor
};

// Available power duration columns (maps to storedAthleteData fields)
const POWER_COLUMNS = [
    { key: 'power_w5', seconds: 5, label: '5s' },
    { key: 'power_w15', seconds: 15, label: '15s' },
    { key: 'power_w60', seconds: 60, label: '1m' },
    { key: 'power_w300', seconds: 300, label: '5m' },
    { key: 'power_w1200', seconds: 1200, label: '20m' }
];

// Available draft columns
const DRAFT_COLUMNS = [
    { key: 'draftCur', path: 'state.draft', label: 'Draft', unit: 'W' },
    { key: 'draftAvg', path: 'stats.draft.avg', label: 'AvgDr', unit: 'W' },
    { key: 'draftEnergy', path: 'stats.draft.kj', label: 'KJDr', unit: 'kJ' }
];

// Default settings
common.settingsStore.setDefault({
    fontScale: 1,
    backgroundOption: 'transparent',  // Key from BACKGROUND_OPTIONS
    customBackgroundColor: '#232323', // Used when backgroundOption is 'custom'
    maxRiders: 10,
    // Max value mode: 'session' = reset each session, 'stored' = persist and auto-update
    maxValueMode: 'stored',
    // Power column settings
    showPower5s: false,
    showPower15s: true,
    showPower60s: true,
    showPower300s: false,
    showPower1200s: false,
    // Draft column settings
    showDraftCur: false,
    showDraftAvg: false,
    showDraftEnergy: false,
    // Team column setting
    showTeamColumn: true,
    // Nearby athletes filter settings
    sortMode: 'position',          // Sort mode: position, name, team
    refreshInterval: 2,            // Refresh interval in seconds
    maxGap: 60,                    // Max gap in seconds to show riders
    filterSameCategory: false,     // Only show riders in same event category
    filterMarked: false            // Only show marked/followed riders
});

// Storage key for consolidated athlete data (global, shared across windows via leading /)
const ATHLETE_DATA_KEY = '/gotta-bike-sauce-athlete-data';

// Default zone colors
const DEFAULT_ZONE_COLORS = {
    zone1: '#888888',
    zone2: '#2196F3',
    zone3: '#4CAF50',
    zone4: '#FFEB3B',
    zone5: '#F44336'
};

// HR Zone definitions (% of max HR) - colors will be updated from settings
const HR_ZONES = [
    { min: 0,   max: 60,  color: DEFAULT_ZONE_COLORS.zone1, name: 'Zone 1 (Recovery)' },
    { min: 60,  max: 70,  color: DEFAULT_ZONE_COLORS.zone2, name: 'Zone 2 (Endurance)' },
    { min: 70,  max: 80,  color: DEFAULT_ZONE_COLORS.zone3, name: 'Zone 3 (Tempo)' },
    { min: 80,  max: 90,  color: DEFAULT_ZONE_COLORS.zone4, name: 'Zone 4 (Threshold)' },
    { min: 90,  max: 999, color: DEFAULT_ZONE_COLORS.zone5, name: 'Zone 5 (VO2 Max)' }
];

// Power Zone definitions (% of max observed power) - colors will be updated from settings
const POWER_ZONES = [
    { min: 0,   max: 60,  color: DEFAULT_ZONE_COLORS.zone1, name: 'Zone 1 (Recovery)' },
    { min: 60,  max: 70,  color: DEFAULT_ZONE_COLORS.zone2, name: 'Zone 2 (Endurance)' },
    { min: 70,  max: 80,  color: DEFAULT_ZONE_COLORS.zone3, name: 'Zone 3 (Tempo)' },
    { min: 80,  max: 90,  color: DEFAULT_ZONE_COLORS.zone4, name: 'Zone 4 (Threshold)' },
    { min: 90,  max: 999, color: DEFAULT_ZONE_COLORS.zone5, name: 'Zone 5 (VO2 Max)' }
];

// Load zone colors from settings
function loadZoneColors() {
    const settings = common.settingsStore.get();

    // Update HR zone colors
    HR_ZONES[0].color = settings.hrZone1Color || DEFAULT_ZONE_COLORS.zone1;
    HR_ZONES[1].color = settings.hrZone2Color || DEFAULT_ZONE_COLORS.zone2;
    HR_ZONES[2].color = settings.hrZone3Color || DEFAULT_ZONE_COLORS.zone3;
    HR_ZONES[3].color = settings.hrZone4Color || DEFAULT_ZONE_COLORS.zone4;
    HR_ZONES[4].color = settings.hrZone5Color || DEFAULT_ZONE_COLORS.zone5;

    // Update Power zone colors
    POWER_ZONES[0].color = settings.powerZone1Color || DEFAULT_ZONE_COLORS.zone1;
    POWER_ZONES[1].color = settings.powerZone2Color || DEFAULT_ZONE_COLORS.zone2;
    POWER_ZONES[2].color = settings.powerZone3Color || DEFAULT_ZONE_COLORS.zone3;
    POWER_ZONES[3].color = settings.powerZone4Color || DEFAULT_ZONE_COLORS.zone4;
    POWER_ZONES[4].color = settings.powerZone5Color || DEFAULT_ZONE_COLORS.zone5;
}

let nearbyData;  // Flat array of nearby athletes
let storedAthleteData = {};  // Persisted: { athleteId: { ...all athlete data including maxHR, power, etc } }
let sessionMaxHRData = {};  // Session-only: { athleteId: maxHR }
let sessionMaxPowerData = {};  // Session-only: { athleteId_seconds: maxPower, ... }
let dialogAthleteId = null;
let dialogAthleteName = null;
let lastRenderTime = 0;  // Track last render time for refresh interval

// Event viewer state
let currentEvent = null;
let currentEntrants = [];

// Helper to get effective max values based on mode
function getEffectiveMaxHR(athleteId) {
    const mode = common.settingsStore.get('maxValueMode') || 'stored';
    if (mode === 'session') {
        return sessionMaxHRData[athleteId] || 0;
    }
    return storedAthleteData[athleteId]?.maxHR || 0;
}

function getEffectiveMaxPower(athleteId, seconds) {
    const mode = common.settingsStore.get('maxValueMode') || 'stored';
    const key = `${athleteId}_${seconds}`;
    if (mode === 'session') {
        return sessionMaxPowerData[key] || 0;
    }
    // Map seconds to the field name in storedAthleteData
    const fieldName = `power_w${seconds}`;
    return storedAthleteData[athleteId]?.[fieldName] || 0;
}

export async function main() {
    common.initInteractionListeners();
    loadStoredAthleteData();
    loadZoneColors();

    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
    applyBackground();

    // Setup dialog event listeners
    setupDialog();

    // Subscribe to nearby data (same as nearby athletes window)
    common.subscribe('nearby', data => {
        if (!data || !data.length) return;
        nearbyData = data;

        // Throttle rendering based on refresh interval setting
        const refreshInterval = (common.settingsStore.get('refreshInterval') || 2) * 1000;  // Convert to ms
        const now = Date.now();
        if (now - lastRenderTime >= refreshInterval) {
            lastRenderTime = now;
            renderRiders();
        }
    });

    // Listen for settings changes
    common.settingsStore.addEventListener('changed', ev => {
        const changed = ev.data.changed;
        if (changed.has('fontScale')) {
            doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
        }
        if (changed.has('backgroundOption') || changed.has('customBackgroundColor')) {
            applyBackground();
        }
        // Reload zone colors if any zone color setting changed
        const zoneColorKeys = [
            'hrZone1Color', 'hrZone2Color', 'hrZone3Color', 'hrZone4Color', 'hrZone5Color',
            'powerZone1Color', 'powerZone2Color', 'powerZone3Color', 'powerZone4Color', 'powerZone5Color'
        ];
        if (zoneColorKeys.some(key => changed.has(key))) {
            loadZoneColors();
        }
        renderRiders();
    });

    // Listen for athlete data changes from other windows
    common.settingsStore.addEventListener('set', ev => {
        if (ev.data.key === ATHLETE_DATA_KEY) {
            storedAthleteData = ev.data.value || {};
            renderRiders();
        }
    });
}

function loadStoredAthleteData() {
    storedAthleteData = common.settingsStore.get(ATHLETE_DATA_KEY) || {};
}

function saveStoredAthleteData() {
    common.settingsStore.set(ATHLETE_DATA_KEY, storedAthleteData);
}

/**
 * Get stored athlete data for a specific athlete
 */
function getStoredAthleteData(athleteId) {
    return storedAthleteData[athleteId] || null;
}

/**
 * Extract team name from rider name (similar to Sauce4Zwift)
 * Looks for team in square brackets [TEAM] or parentheses (TEAM)
 * @param {string} name - Rider name that may contain team
 * @returns {string|null} - Extracted team name or null
 */
function extractTeamFromName(name) {
    if (!name) return null;

    // Try square brackets first: [TEAM]
    const bracketMatch = name.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
        return bracketMatch[1].trim();
    }

    // Try parentheses: (TEAM)
    const parenMatch = name.match(/\(([^)]+)\)/);
    if (parenMatch) {
        return parenMatch[1].trim();
    }

    return null;
}

/**
 * Import athlete data from GOTTA.BIKE API response
 * Stores all data in consolidated storedAthleteData structure
 * Preserves user-edited fields (marked in userEdited object)
 */
function importGottaAthleteData(riderData) {
    if (!riderData || !riderData.riderId) return null;

    const athleteId = riderData.riderId;

    // Get existing data to preserve user edits
    const existingData = storedAthleteData[athleteId] || {};
    const existingUserEdited = existingData.userEdited || {};

    // Determine team: preserve user edit, or API value, or extract from name, or keep existing
    let team;
    if (existingUserEdited.team) {
        team = existingData.team;  // User edited, don't overwrite
    } else {
        team = riderData.team || extractTeamFromName(riderData.name) || existingData.team || null;
    }

    // Determine name: preserve user edit or use API value
    let name;
    if (existingUserEdited.name) {
        name = existingData.name;  // User edited, don't overwrite
    } else {
        name = riderData.name || existingData.name || null;
    }

    // Store all API fields, preserving user-edited values
    storedAthleteData[athleteId] = {
        ...riderData,
        name: name,
        team: team,
        // Preserve existing maxHR if user edited
        maxHR: existingUserEdited.maxHR ? existingData.maxHR : (existingData.maxHR || null),
        // Preserve userEdited flags
        userEdited: existingUserEdited,
        // Add import timestamp
        importedAt: Date.now()
    };

    return storedAthleteData[athleteId];
}

/**
 * Bulk import athletes from GOTTA.BIKE API
 * @param {number[]} athleteIds - Array of athlete IDs to import
 * @param {function} onProgress - Optional callback for progress updates (imported, total)
 * @returns {Promise<{success: number, failed: number, errors: string[]}>}
 */
async function bulkImportFromGotta(athleteIds, onProgress = null) {
    const authData = common.settingsStore.get(GOTTA_AUTH_KEY);
    if (!authData?.api_key) {
        throw new Error('Please authenticate with GOTTA.BIKE first');
    }

    if (authData.expires_at && Date.now() > authData.expires_at) {
        throw new Error('API key expired. Please re-authenticate.');
    }

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    try {
        const response = await fetch(`${GOTTA_API_URL}/api_v1/zrapp/riders_sauce_mod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sauce-API-Key': authData.api_key
            },
            body: JSON.stringify({
                rider_ids: athleteIds
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const riders = data.riders || [];

        // Import each rider
        for (let i = 0; i < riders.length; i++) {
            try {
                importGottaAthleteData(riders[i]);
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`${riders[i].riderId}: ${err.message}`);
            }

            if (onProgress) {
                onProgress(i + 1, riders.length);
            }
        }

        // Count athletes not found in response
        const returnedIds = new Set(riders.map(r => r.riderId));
        for (const id of athleteIds) {
            if (!returnedIds.has(id)) {
                results.failed++;
                results.errors.push(`${id}: Not found in database`);
            }
        }

        // Save all data
        saveStoredAthleteData();

    } catch (error) {
        throw error;
    }

    return results;
}

function updateMaxPower(athleteId, powerValues, name, team) {
    // powerValues is an object like { 5: watts, 15: watts, 60: watts, ... }
    const mode = common.settingsStore.get('maxValueMode') || 'stored';
    let storedUpdated = false;

    for (const [seconds, power] of Object.entries(powerValues)) {
        if (power > 0) {
            const sessionKey = `${athleteId}_${seconds}`;
            const fieldName = `power_w${seconds}`;
            const roundedPower = Math.round(power);

            // Always update session max
            if (!sessionMaxPowerData[sessionKey] || roundedPower > sessionMaxPowerData[sessionKey]) {
                sessionMaxPowerData[sessionKey] = roundedPower;
            }

            // Update stored max if in stored mode (only if greater than current)
            if (mode === 'stored') {
                const currentStored = storedAthleteData[athleteId]?.[fieldName] || 0;
                if (roundedPower > currentStored) {
                    storedUpdated = true;
                }
            }
        }
    }

    // Update storedAthleteData with new power values and name/team
    if (storedUpdated && mode === 'stored') {
        const existingData = storedAthleteData[athleteId] || {};
        const existingUserEdited = existingData.userEdited || {};

        // Build updated power fields (only update if greater)
        const updatedPower = {};
        for (const [seconds, power] of Object.entries(powerValues)) {
            if (power > 0) {
                const fieldName = `power_w${seconds}`;
                const roundedPower = Math.round(power);
                const currentStored = existingData[fieldName] || 0;
                if (roundedPower > currentStored) {
                    updatedPower[fieldName] = roundedPower;
                }
            }
        }

        storedAthleteData[athleteId] = {
            ...existingData,
            ...updatedPower,
            name: existingUserEdited.name ? existingData.name : (name || existingData.name || null),
            team: existingUserEdited.team ? existingData.team : (team || existingData.team || null),
            userEdited: existingUserEdited,
            lastSeenLive: Date.now()
        };
        saveStoredAthleteData();
    }
}

function updateMaxHR(athleteId, hr, name, team) {
    if (hr <= 0) return;

    const mode = common.settingsStore.get('maxValueMode') || 'stored';
    const roundedHR = Math.round(hr);

    // Always update session max
    if (!sessionMaxHRData[athleteId] || roundedHR > sessionMaxHRData[athleteId]) {
        sessionMaxHRData[athleteId] = roundedHR;
    }

    // Update stored max if in stored mode (only if greater than current)
    if (mode === 'stored') {
        const existingData = storedAthleteData[athleteId] || {};
        const existingUserEdited = existingData.userEdited || {};
        const currentStoredHR = existingData.maxHR || 0;

        // Only update if new HR is greater and not user-edited
        if (roundedHR > currentStoredHR && !existingUserEdited.maxHR) {
            storedAthleteData[athleteId] = {
                ...existingData,
                maxHR: roundedHR,
                name: existingUserEdited.name ? existingData.name : (name || existingData.name || null),
                team: existingUserEdited.team ? existingData.team : (team || existingData.team || null),
                userEdited: existingUserEdited,
                lastSeenLive: Date.now()
            };
            saveStoredAthleteData();
        }
    }
}


function applyBackground() {
    const option = common.settingsStore.get('backgroundOption') || 'transparent';
    let color = null;

    if (option === 'custom') {
        color = common.settingsStore.get('customBackgroundColor') || '#232323';
    } else if (BACKGROUND_OPTIONS[option]) {
        color = BACKGROUND_OPTIONS[option].color;
    }

    if (color) {
        doc.style.setProperty('--background-color', color);
        doc.classList.add('solid-background');
    } else {
        doc.classList.remove('solid-background');
        doc.style.removeProperty('--background-color');
    }
}

function getHRZone(hr, maxHR) {
    if (!maxHR || !hr || maxHR <= 0 || hr <= 0) return null;
    const pct = (hr / maxHR) * 100;
    return HR_ZONES.find(zone => pct >= zone.min && pct < zone.max);
}

function getPowerZone(power, maxPower) {
    if (!maxPower || !power || maxPower <= 0 || power <= 0) return null;
    const pct = (power / maxPower) * 100;
    return POWER_ZONES.find(zone => pct >= zone.min && pct < zone.max);
}

function getContrastColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function truncateName(name, maxLen) {
    if (!name) return 'Unknown';
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen - 1) + '\u2026';
}

function applyFilters(riders, settings, watchingAthlete) {
    const maxGap = settings.maxGap || 60;  // Default 60 seconds
    const filterSameCategory = settings.filterSameCategory || false;
    const filterMarked = settings.filterMarked || false;

    return riders.filter(athlete => {
        // Always filter by max gap (time gap in seconds)
        // The 'gap' field represents time gap in seconds from watching athlete
        if (Math.abs(athlete.gap) > maxGap) {
            return false;
        }

        // If "Only same category" is enabled, filter to same event subgroup
        if (filterSameCategory) {
            if (!watchingAthlete?.state?.eventSubgroupId ||
                athlete.state?.eventSubgroupId !== watchingAthlete.state.eventSubgroupId) {
                return false;
            }
        }

        // If "Only marked" is enabled, filter to marked/followed riders
        if (filterMarked) {
            if (!athlete.athlete?.marked && !athlete.athlete?.following) {
                return false;
            }
        }

        return true;
    });
}

function setupDialog() {
    const dialog = document.getElementById('max-hr-dialog');
    const cancelBtn = document.getElementById('dialog-cancel');
    const saveBtn = document.getElementById('dialog-save');
    const hrInput = document.getElementById('dialog-max-hr');

    cancelBtn.addEventListener('click', () => {
        dialog.hidden = true;
        dialogAthleteId = null;
        dialogAthleteName = null;
    });

    saveBtn.addEventListener('click', () => {
        const maxHR = parseInt(hrInput.value);
        if (dialogAthleteId && maxHR && maxHR >= 100 && maxHR <= 250) {
            const existingData = storedAthleteData[dialogAthleteId] || {};
            storedAthleteData[dialogAthleteId] = {
                ...existingData,
                maxHR: maxHR,
                name: dialogAthleteName || existingData.name || null,
                userEdited: { ...(existingData.userEdited || {}), maxHR: true }
            };
            saveStoredAthleteData();
            renderRiders();
        }
        dialog.hidden = true;
        dialogAthleteId = null;
        dialogAthleteName = null;
    });

    // Also allow Enter key to save
    hrInput.addEventListener('keypress', (ev) => {
        if (ev.key === 'Enter') {
            saveBtn.click();
        }
    });

    // Close on overlay click
    dialog.addEventListener('click', (ev) => {
        if (ev.target === dialog) {
            dialog.hidden = true;
            dialogAthleteId = null;
            dialogAthleteName = null;
        }
    });
}

function showMaxHRDialog(athleteId, name, currentMaxHR) {
    const dialog = document.getElementById('max-hr-dialog');
    const hrInput = document.getElementById('dialog-max-hr');
    const nameEl = dialog.querySelector('.dialog-rider-name');

    dialogAthleteId = athleteId;
    dialogAthleteName = name;

    nameEl.textContent = name || `Athlete ${athleteId}`;
    hrInput.value = currentMaxHR || '';
    hrInput.placeholder = 'Max HR (e.g. 185)';

    dialog.hidden = false;
    hrInput.focus();
    hrInput.select();
}

function sortRiders(riders, sortMode) {
    const sorted = [...riders];
    switch (sortMode) {
        case 'name':
            sorted.sort((a, b) => {
                const nameA = a.athlete?.sanitizedFullname || '';
                const nameB = b.athlete?.sanitizedFullname || '';
                return nameA.localeCompare(nameB);
            });
            break;
        case 'team':
            sorted.sort((a, b) => {
                const teamA = storedAthleteData[a.athleteId]?.team || a.athlete?.team || '';
                const teamB = storedAthleteData[b.athleteId]?.team || b.athlete?.team || '';
                // First sort by team name
                const teamCompare = teamA.localeCompare(teamB);
                if (teamCompare !== 0) return teamCompare;
                // Then by position (gap)
                return (a.gap || 0) - (b.gap || 0);
            });
            break;
        case 'position':
        default:
            // Already sorted by position (gap) from the nearby data
            break;
    }
    return sorted;
}

function renderRiders() {
    if (!nearbyData || !nearbyData.length) return;

    const settings = common.settingsStore.get();
    const tbody = document.getElementById('rider-table');
    tbody.innerHTML = '';

    const maxRiders = settings.maxRiders || 20;

    // Find the watching athlete for filter comparisons
    const watchingAthlete = nearbyData.find(a => a.watching);

    // Apply filters, sort, and limit riders
    let riders = applyFilters(nearbyData, settings, watchingAthlete);
    riders = sortRiders(riders, settings.sortMode || 'position');
    riders = riders.slice(0, maxRiders);

    for (const athlete of riders) {
        const athleteId = athlete.athleteId;
        const name = athlete.athlete?.sanitizedFullname || `Rider ${athleteId}`;
        const team = athlete.athlete?.team || '';
        const hr = (athlete.state && athlete.state.heartrate) || 0;

        // Update max HR tracking
        if (hr > 0) {
            updateMaxHR(athleteId, hr, name, team);
        }

        const maxHR = getEffectiveMaxHR(athleteId);
        const zone = getHRZone(hr, maxHR);

        const row = document.createElement('tr');
        row.dataset.athleteId = athleteId;

        // Make row clickable to set max HR (only useful in stored mode)
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            showMaxHRDialog(athleteId, name, storedAthleteData[athleteId]?.maxHR);
        });

        // Name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'name-cell';
        nameCell.textContent = truncateName(name, 15);
        nameCell.title = name;

        // Team cell (if enabled)
        let teamCell = null;
        if (settings.showTeamColumn) {
            const storedTeam = storedAthleteData[athleteId]?.team;
            const displayTeam = storedTeam || team;
            teamCell = document.createElement('td');
            teamCell.className = 'team-cell';
            teamCell.textContent = truncateName(displayTeam, 10) || '-';
            teamCell.title = displayTeam || 'No team';
        }

        // HR cell with zone coloring - show % of max HR
        const hrCell = document.createElement('td');
        hrCell.className = 'hr-cell';

        if (hr > 0 && maxHR) {
            const pct = Math.round((hr / maxHR) * 100);
            hrCell.textContent = `${pct}%`;
            hrCell.title = `${hr} bpm (${zone?.name || 'Unknown zone'}, max: ${maxHR})`;
        } else if (hr > 0) {
            hrCell.textContent = hr;
            hrCell.title = 'Click row to set max HR to see %';
            hrCell.classList.add('no-max-hr');
        } else {
            hrCell.textContent = '-';
        }

        if (zone) {
            hrCell.style.backgroundColor = zone.color;
            hrCell.style.color = getContrastColor(zone.color);
        }

        // Get enabled power columns
        const enabledPowerColumns = POWER_COLUMNS.filter(col =>
            settings[`show${col.key.charAt(0).toUpperCase() + col.key.slice(1)}`]
        );

        // Collect power values for all durations and update max
        const powerValues = {};
        for (const col of POWER_COLUMNS) {
            const power = athlete.stats?.power?.smooth?.[col.seconds] || 0;
            if (power > 0) {
                powerValues[col.seconds] = power;
            }
        }
        if (Object.keys(powerValues).length > 0) {
            updateMaxPower(athleteId, powerValues, name, team);
        }

        // Create power cells for enabled columns
        const powerCells = [];
        for (const col of enabledPowerColumns) {
            const power = athlete.stats?.power?.smooth?.[col.seconds] || 0;
            const maxPower = getEffectiveMaxPower(athleteId, col.seconds);
            const powerZone = getPowerZone(power, maxPower);

            const powerCell = document.createElement('td');
            powerCell.className = 'power-cell';

            if (power > 0 && maxPower > 0) {
                const pct = Math.round((power / maxPower) * 100);
                powerCell.textContent = `${pct}%`;
                powerCell.title = `${power}W (${powerZone?.name || 'Unknown'}, max: ${maxPower}W)`;

                // Apply zone coloring
                if (powerZone) {
                    powerCell.style.backgroundColor = powerZone.color;
                    powerCell.style.color = getContrastColor(powerZone.color);
                }
            } else if (power > 0) {
                powerCell.textContent = power;
                powerCell.title = `${power}W (building max...)`;
            } else {
                powerCell.textContent = '-';
            }

            powerCells.push(powerCell);
        }

        // Get enabled draft columns
        const enabledDraftColumns = DRAFT_COLUMNS.filter(col =>
            settings[`show${col.key.charAt(0).toUpperCase() + col.key.slice(1)}`]
        );

        // Create draft cells for enabled columns
        const draftCells = [];
        for (const col of enabledDraftColumns) {
            const draftCell = document.createElement('td');
            draftCell.className = 'draft-cell';

            // Get draft value using path (e.g., "state.draft" or "stats.draft.avg")
            const pathParts = col.path.split('.');
            let value = athlete;
            for (const part of pathParts) {
                value = value?.[part];
            }

            if (value !== undefined && value !== null && value !== 0) {
                if (col.unit === 'kJ') {
                    // Already in kJ, format with 1 decimal
                    draftCell.textContent = value.toFixed(1);
                    draftCell.title = `${col.label}: ${value.toFixed(1)} kJ`;
                } else {
                    // Watts - round to integer
                    draftCell.textContent = Math.round(value);
                    draftCell.title = `${col.label}: ${Math.round(value)} W`;
                }
            } else {
                draftCell.textContent = '-';
            }

            draftCells.push(draftCell);
        }

        // Add watching indicator
        if (athlete.watching) {
            row.classList.add('watching');
        }

        row.appendChild(nameCell);
        if (teamCell) {
            row.appendChild(teamCell);
        }
        row.appendChild(hrCell);
        for (const cell of powerCells) {
            row.appendChild(cell);
        }
        for (const cell of draftCells) {
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    }

    // Update table headers based on enabled columns
    updateTableHeaders(settings);
}

function updateTableHeaders(settings) {
    const thead = document.querySelector('#content table thead tr');
    if (!thead) return;

    // Get enabled power columns
    const enabledPowerColumns = POWER_COLUMNS.filter(col =>
        settings[`show${col.key.charAt(0).toUpperCase() + col.key.slice(1)}`]
    );

    // Get enabled draft columns
    const enabledDraftColumns = DRAFT_COLUMNS.filter(col =>
        settings[`show${col.key.charAt(0).toUpperCase() + col.key.slice(1)}`]
    );

    // Rebuild headers: Rider, Team (if enabled), %HR, power columns, draft columns
    thead.innerHTML = '<th>Rider</th>';
    if (settings.showTeamColumn) {
        const teamTh = document.createElement('th');
        teamTh.textContent = 'Team';
        thead.appendChild(teamTh);
    }
    const hrTh = document.createElement('th');
    hrTh.textContent = '%HR';
    thead.appendChild(hrTh);
    for (const col of enabledPowerColumns) {
        const th = document.createElement('th');
        th.textContent = col.label;
        thead.appendChild(th);
    }
    for (const col of enabledDraftColumns) {
        const th = document.createElement('th');
        th.textContent = col.label;
        thead.appendChild(th);
    }
}

// Settings page exports
export async function settingsMain() {
    common.initInteractionListeners();
    await common.initSettingsForm('form#options')();
    await common.initSettingsForm('form#power-columns')();
    await common.initSettingsForm('form#draft-columns')();
    await common.initSettingsForm('form#filter-options')();
    await common.initSettingsForm('form#hr-zone-colors')();
    await common.initSettingsForm('form#power-zone-colors')();

    // Resize window to fit content
    window.resizeTo(850, 600);

    loadStoredMaxHRData();
    loadStoredMaxPowerData();
    loadStoredAthleteData();
    setupBackgroundOptionToggle();
    setupTabNavigation();
    setupZoneColorPreviews();
    setupZoneColorResetButtons();
}

// Tab navigation
function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panel visibility
            tabPanels.forEach(panel => {
                panel.classList.toggle('active', panel.id === targetTab);
            });
        });
    });
}

// Event Viewer functions
async function setupEventViewer() {
    // Load saved column configuration
    const savedColumns = common.settingsStore.get(EVENT_VIEWER_COLUMNS_KEY);
    if (savedColumns && Array.isArray(savedColumns)) {
        visibleEventColumns = savedColumns;
    }

    const savedSort = common.settingsStore.get(EVENT_VIEWER_SORT_KEY);
    if (savedSort) {
        eventViewerSort = savedSort;
    }

    // Load cached events on startup
    await loadCachedEvents();

    const loadBtn = document.getElementById('load-event-btn');
    const eventInput = document.getElementById('event-input');
    const cachedSelect = document.getElementById('cached-events');
    const subgroupSelect = document.getElementById('subgroup-select');
    const entrantSearch = document.getElementById('entrant-search');

    // Setup column configuration
    setupColumnConfig();

    // Setup chart controls
    setupChartControls();

    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const input = eventInput.value.trim();
            if (input) {
                const eventId = parseEventInput(input);
                if (eventId) {
                    loadEvent(eventId);
                } else {
                    showEventError('Invalid event ID or URL');
                }
            }
        });
    }

    if (eventInput) {
        eventInput.addEventListener('keypress', (ev) => {
            if (ev.key === 'Enter') {
                loadBtn.click();
            }
        });
    }

    if (cachedSelect) {
        cachedSelect.addEventListener('change', () => {
            const eventId = cachedSelect.value;
            if (eventId) {
                loadEvent(parseInt(eventId));
            }
        });
    }

    if (subgroupSelect) {
        subgroupSelect.addEventListener('change', () => {
            const subgroupId = subgroupSelect.value;
            if (subgroupId && currentEvent) {
                loadSubgroupEntrants(parseInt(subgroupId));
            } else {
                document.getElementById('subgroup-info').hidden = true;
                document.getElementById('entrants-section').hidden = true;
            }
        });
    }

    if (entrantSearch) {
        entrantSearch.addEventListener('input', () => {
            renderEntrants(entrantSearch.value);
        });
    }

    // Bulk import from GOTTA.BIKE button
    const bulkImportBtn = document.getElementById('gotta-bulk-import-btn');
    if (bulkImportBtn) {
        bulkImportBtn.addEventListener('click', async () => {
            if (!currentEntrants || currentEntrants.length === 0) {
                setGottaBulkImportStatus('error', 'No entrants to import');
                return;
            }

            // Get all athlete IDs
            const athleteIds = currentEntrants
                .map(e => e.id || e.athleteId)
                .filter(id => id && id > 0);

            if (athleteIds.length === 0) {
                setGottaBulkImportStatus('error', 'No valid athlete IDs found');
                return;
            }

            // Disable button and show progress
            bulkImportBtn.disabled = true;
            bulkImportBtn.textContent = 'Importing...';
            setGottaBulkImportStatus('loading', `Importing ${athleteIds.length} athletes...`);

            try {
                const results = await bulkImportFromGotta(athleteIds, (current, total) => {
                    setGottaBulkImportStatus('loading', `Importing ${current} of ${total}...`);
                });

                if (results.success > 0) {
                    let message = `Imported ${results.success} athletes`;
                    if (results.failed > 0) {
                        message += `, ${results.failed} not found`;
                    }
                    setGottaBulkImportStatus('success', message);

                    // Re-render entrants to show updated data
                    renderEntrants(entrantSearch?.value || '');

                    // Update chart with new data
                    renderPowerBubbleChart();
                } else {
                    setGottaBulkImportStatus('error', 'No athletes found in GOTTA.BIKE database');
                }
            } catch (error) {
                console.error('Bulk import error:', error);
                setGottaBulkImportStatus('error', error.message);
            } finally {
                bulkImportBtn.disabled = false;
                bulkImportBtn.textContent = 'Import Data';
            }
        });
    }
}

/**
 * Set the bulk import status message
 */
function setGottaBulkImportStatus(state, message) {
    const statusDiv = document.getElementById('gotta-bulk-import-status');
    if (!statusDiv) return;

    statusDiv.className = 'gotta-bulk-import-status ' + state;

    if (state === 'loading') {
        statusDiv.innerHTML = `<span class="spinner-inline"></span> ${message}`;
    } else {
        statusDiv.textContent = message;
    }
}

/**
 * Setup column configuration panel
 */
function setupColumnConfig() {
    const configBtn = document.getElementById('column-config-btn');
    const configPanel = document.getElementById('column-config-panel');
    const checkboxContainer = document.getElementById('column-checkboxes');
    const resetBtn = document.getElementById('reset-columns-btn');

    if (!configBtn || !configPanel || !checkboxContainer) return;

    // Build checkboxes for each available column
    checkboxContainer.innerHTML = '';
    for (const col of AVAILABLE_COLUMNS) {
        const label = document.createElement('label');
        label.className = 'column-checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = col.id;
        checkbox.checked = visibleEventColumns.includes(col.id);

        // Name column is always required
        if (col.id === 'name') {
            checkbox.disabled = true;
            checkbox.checked = true;
        }

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!visibleEventColumns.includes(col.id)) {
                    visibleEventColumns.push(col.id);
                }
            } else {
                visibleEventColumns = visibleEventColumns.filter(id => id !== col.id);
            }
            common.settingsStore.set(EVENT_VIEWER_COLUMNS_KEY, visibleEventColumns);
            renderEntrants(document.getElementById('entrant-search')?.value || '');
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(col.label));
        checkboxContainer.appendChild(label);
    }

    // Toggle panel visibility
    configBtn.addEventListener('click', () => {
        configPanel.hidden = !configPanel.hidden;
    });

    // Reset to defaults
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            visibleEventColumns = [...DEFAULT_VISIBLE_COLUMNS];
            common.settingsStore.set(EVENT_VIEWER_COLUMNS_KEY, visibleEventColumns);

            // Update checkboxes
            const checkboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = visibleEventColumns.includes(cb.value) || cb.value === 'name';
            });

            renderEntrants(document.getElementById('entrant-search')?.value || '');
        });
    }
}

/**
 * Handle column header click for sorting
 */
function handleColumnSort(columnId) {
    if (eventViewerSort.column === columnId) {
        eventViewerSort.ascending = !eventViewerSort.ascending;
    } else {
        eventViewerSort.column = columnId;
        eventViewerSort.ascending = true;
    }
    common.settingsStore.set(EVENT_VIEWER_SORT_KEY, eventViewerSort);
    renderEntrants(document.getElementById('entrant-search')?.value || '');
}

/**
 * Get sort value for comparison
 */
function getSortValue(entrant, columnId) {
    const col = AVAILABLE_COLUMNS.find(c => c.id === columnId);
    if (!col) return '';

    const athleteId = entrant.id || entrant.athleteId;
    const athleteData = storedAthleteData[athleteId];
    const value = col.getValue(entrant, athleteData);

    // Convert to number for numeric columns
    if (col.type === 'number' && value !== '') {
        return parseFloat(value) || 0;
    }
    return String(value).toLowerCase();
}

async function loadCachedEvents() {
    try {
        const cachedEvents = await common.rpc.getCachedEvents();
        const select = document.getElementById('cached-events');
        if (!select) return;

        // Clear existing options except the first one
        select.innerHTML = '<option value="">-- Select Event --</option>';

        if (cachedEvents && cachedEvents.length > 0) {
            // Sort by start time, most recent first
            cachedEvents.sort((a, b) => new Date(b.eventStart) - new Date(a.eventStart));

            for (const event of cachedEvents) {
                const opt = document.createElement('option');
                opt.value = event.id;
                const startDate = new Date(event.eventStart);
                opt.textContent = `${event.name} (${formatEventDate(startDate)})`;
                select.appendChild(opt);
            }
        }
    } catch (err) {
        console.error('Failed to load cached events:', err);
    }
}

function parseEventInput(input) {
    // Try to parse as a number (event ID)
    const numericId = parseInt(input);
    if (!isNaN(numericId) && numericId > 0) {
        return numericId;
    }

    // Try to extract event ID from Zwift URL
    const urlMatch = input.match(/zwift\.com\/events\/view\/(\d+)/i);
    if (urlMatch) {
        return parseInt(urlMatch[1]);
    }

    // Try to extract from invite link format
    const inviteMatch = input.match(/events\/view\/(\d+)/i);
    if (inviteMatch) {
        return parseInt(inviteMatch[1]);
    }

    return null;
}

async function loadEvent(eventId) {
    showEventLoading(true);
    hideEventError();
    document.getElementById('event-info').hidden = true;

    try {
        const event = await common.rpc.getEvent(eventId);

        if (!event) {
            showEventError(`Event ${eventId} not found`);
            return;
        }

        currentEvent = event;
        displayEventInfo(event);
    } catch (err) {
        console.error('Failed to load event:', err);
        showEventError(`Failed to load event: ${err.message}`);
    } finally {
        showEventLoading(false);
    }
}

function displayEventInfo(event) {
    document.getElementById('event-name').textContent = event.name;

    const startDate = new Date(event.eventStart);
    document.getElementById('event-start').textContent = formatEventDateTime(startDate);

    // Populate subgroup selector
    const subgroupSelect = document.getElementById('subgroup-select');
    subgroupSelect.innerHTML = '<option value="">-- Select Category --</option>';

    if (event.eventSubgroups && event.eventSubgroups.length > 0) {
        // Sort subgroups by label
        const sortedSubgroups = [...event.eventSubgroups].sort((a, b) => {
            return (a.subgroupLabel || '').localeCompare(b.subgroupLabel || '');
        });

        for (const sg of sortedSubgroups) {
            const opt = document.createElement('option');
            opt.value = sg.id;
            let label = sg.subgroupLabel || `Subgroup ${sg.id}`;
            if (sg.rangeAccessLabel) {
                label += ` (${sg.rangeAccessLabel})`;
            }
            opt.textContent = label;
            subgroupSelect.appendChild(opt);
        }
    }

    document.getElementById('event-info').hidden = false;
    document.getElementById('subgroup-info').hidden = true;
    document.getElementById('entrants-section').hidden = true;
}

async function loadSubgroupEntrants(subgroupId) {
    showEventLoading(true);

    try {
        // Get subgroup details
        const sgInfo = await common.rpc.getEventSubgroup(subgroupId);
        displaySubgroupInfo(sgInfo);

        // Get entrants
        const entrants = await common.rpc.getEventSubgroupEntrants(subgroupId);
        currentEntrants = entrants || [];

        document.getElementById('entrant-count').textContent = currentEntrants.length;
        document.getElementById('entrant-search').value = '';
        renderEntrants();

        // Render chart (will show after data is imported)
        renderPowerBubbleChart();

        document.getElementById('entrants-section').hidden = false;
    } catch (err) {
        console.error('Failed to load subgroup entrants:', err);
        showEventError(`Failed to load entrants: ${err.message}`);
    } finally {
        showEventLoading(false);
    }
}

function displaySubgroupInfo(sgInfo) {
    if (!sgInfo) {
        document.getElementById('subgroup-info').hidden = true;
        return;
    }

    // Route info
    document.getElementById('sg-route').textContent =
        sgInfo.routeId ? `Route ${sgInfo.routeId} (Course ${sgInfo.courseId})` : 'N/A';

    // Distance
    if (sgInfo.distanceInMeters) {
        const km = (sgInfo.distanceInMeters / 1000).toFixed(1);
        const mi = (sgInfo.distanceInMeters / 1609.34).toFixed(1);
        document.getElementById('sg-distance').textContent = `${km} km (${mi} mi)`;
    } else {
        document.getElementById('sg-distance').textContent = 'N/A';
    }

    // Laps
    document.getElementById('sg-laps').textContent = sgInfo.laps || 'N/A';

    // Start time
    if (sgInfo.eventSubgroupStart) {
        const startDate = new Date(sgInfo.eventSubgroupStart);
        document.getElementById('sg-start').textContent = formatEventDateTime(startDate);
    } else {
        document.getElementById('sg-start').textContent = 'N/A';
    }

    document.getElementById('subgroup-info').hidden = false;
}

function renderEntrants(searchFilter = '') {
    const container = document.getElementById('entrants-list');
    if (!container) return;

    container.innerHTML = '';

    let filteredEntrants = [...currentEntrants];

    if (searchFilter) {
        const filterLower = searchFilter.toLowerCase();
        filteredEntrants = filteredEntrants.filter(entrant => {
            const athleteId = entrant.id || entrant.athleteId;
            const name = getEntrantName(entrant).toLowerCase();
            const team = (entrant.team || storedAthleteData[athleteId]?.team || '').toLowerCase();
            const idStr = String(athleteId);
            return name.includes(filterLower) || team.includes(filterLower) || idStr.includes(filterLower);
        });
    }

    // Get visible columns (ensure name is always first)
    const columns = AVAILABLE_COLUMNS.filter(col => visibleEventColumns.includes(col.id));

    // Build header row with sortable columns
    const headerRow = document.createElement('div');
    headerRow.className = 'entrant-row entrant-header';

    for (const col of columns) {
        const headerCell = document.createElement('div');
        headerCell.className = `entrant-cell entrant-cell-${col.id} sortable-header`;
        headerCell.dataset.columnId = col.id;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = col.label;
        headerCell.appendChild(labelSpan);

        // Add sort indicator
        if (eventViewerSort.column === col.id) {
            const sortIcon = document.createElement('ms');
            sortIcon.textContent = eventViewerSort.ascending ? 'arrow_upward' : 'arrow_downward';
            sortIcon.className = 'sort-icon';
            headerCell.appendChild(sortIcon);
        }

        headerCell.addEventListener('click', () => handleColumnSort(col.id));
        headerRow.appendChild(headerCell);
    }

    container.appendChild(headerRow);

    if (filteredEntrants.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'no-riders';
        emptyMsg.textContent = searchFilter ? 'No entrants match your search.' : 'No entrants found';
        container.appendChild(emptyMsg);
        return;
    }

    // Sort entrants
    filteredEntrants.sort((a, b) => {
        const aVal = getSortValue(a, eventViewerSort.column);
        const bVal = getSortValue(b, eventViewerSort.column);

        let result;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            result = aVal - bVal;
        } else {
            result = String(aVal).localeCompare(String(bVal));
        }

        return eventViewerSort.ascending ? result : -result;
    });

    // Render each entrant row
    for (const entrant of filteredEntrants) {
        const athleteId = entrant.id || entrant.athleteId;
        const athleteData = storedAthleteData[athleteId] || {};
        const name = getEntrantName(entrant);

        const row = document.createElement('div');
        row.className = 'entrant-row';

        // Check if we have GOTTA.BIKE data
        if (athleteData.importedAt) {
            row.classList.add('has-gotta-data');
        }

        for (const col of columns) {
            const cell = document.createElement('div');
            cell.className = `entrant-cell entrant-cell-${col.id}`;

            const value = col.getValue(entrant, athleteData);

            if (col.id === 'name') {
                // Special handling for name column - show name and ID
                const nameSpan = document.createElement('span');
                nameSpan.className = 'entrant-name';
                nameSpan.textContent = value;
                cell.appendChild(nameSpan);

                const idSpan = document.createElement('span');
                idSpan.className = 'entrant-id';
                idSpan.textContent = `ID: ${athleteId}`;
                cell.appendChild(idSpan);
            } else if (col.editable) {
                // Editable field
                const input = document.createElement('input');
                input.type = col.type === 'number' ? 'number' : 'text';
                input.className = 'entrant-input';
                input.value = value;
                input.placeholder = col.label;

                if (col.min !== undefined) input.min = col.min;
                if (col.max !== undefined) input.max = col.max;

                input.addEventListener('change', (ev) => {
                    const newValue = col.type === 'number' ? parseInt(ev.target.value) : ev.target.value.trim();
                    const data = storedAthleteData[athleteId] || {};

                    if (col.id === 'maxHR') {
                        if (newValue >= 100 && newValue <= 250) {
                            storedAthleteData[athleteId] = {
                                ...data,
                                maxHR: Math.round(newValue),
                                name: data.name || name,
                                userEdited: { ...(data.userEdited || {}), maxHR: true }
                            };
                            saveStoredAthleteData();
                        } else if (ev.target.value === '') {
                            storedAthleteData[athleteId] = {
                                ...data,
                                maxHR: null,
                                userEdited: { ...(data.userEdited || {}), maxHR: false }
                            };
                            saveStoredAthleteData();
                        }
                    } else if (col.id === 'team') {
                        storedAthleteData[athleteId] = {
                            ...data,
                            team: newValue || null,
                            name: data.name || name,
                            userEdited: { ...(data.userEdited || {}), team: !!newValue }
                        };
                        saveStoredAthleteData();
                    } else if (col.powerSeconds) {
                        const fieldName = `power_w${col.powerSeconds}`;
                        storedAthleteData[athleteId] = {
                            ...data,
                            [fieldName]: newValue > 0 ? Math.round(newValue) : null,
                            name: data.name || name
                        };
                        saveStoredAthleteData();
                    }
                });

                cell.appendChild(input);
            } else {
                // Read-only field
                let displayValue = value;
                if (col.type === 'number' && value !== '' && value !== null && value !== undefined) {
                    displayValue = typeof value === 'number' ? Math.round(value) : value;
                    if (col.suffix) {
                        displayValue = `${displayValue}`;
                    }
                }
                cell.textContent = displayValue || '-';
            }

            row.appendChild(cell);
        }

        container.appendChild(row);
    }
}

function getEntrantName(entrant) {
    // Try various field name combinations the API might use
    if (entrant.firstName && entrant.lastName) {
        return `${entrant.firstName} ${entrant.lastName}`;
    }
    if (entrant.first_name && entrant.last_name) {
        return `${entrant.first_name} ${entrant.last_name}`;
    }
    if (entrant.sanitizedFullname) {
        return entrant.sanitizedFullname;
    }
    if (entrant.fullName) {
        return entrant.fullName;
    }
    if (entrant.name) {
        return entrant.name;
    }
    if (entrant.athlete?.sanitizedFullname) {
        return entrant.athlete.sanitizedFullname;
    }
    if (entrant.athlete?.firstName && entrant.athlete?.lastName) {
        return `${entrant.athlete.firstName} ${entrant.athlete.lastName}`;
    }
    if (entrant.firstName) {
        return entrant.firstName;
    }
    if (entrant.lastName) {
        return entrant.lastName;
    }
    if (entrant.first_name) {
        return entrant.first_name;
    }
    if (entrant.last_name) {
        return entrant.last_name;
    }
    // Log the entrant structure to help debug
    console.log('Unknown entrant structure:', Object.keys(entrant), entrant);
    return `Athlete ${entrant.id || entrant.athleteId || 'Unknown'}`;
}

function formatEventDate(date) {
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatEventDateTime(date) {
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showEventLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.hidden = !show;
}

function showEventError(message) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
    }
}

function hideEventError() {
    const el = document.getElementById('error-message');
    if (el) el.hidden = true;
}

// ============================================================================
// Power Bubble Chart
// ============================================================================

// Chart instance reference
let powerBubbleChart = null;

// Power durations for the chart (in seconds)
const CHART_POWER_DURATIONS = [
    { seconds: 5, field: 'power_w5', wkgField: 'power_wkg5', label: '5s' },
    { seconds: 15, field: 'power_w15', wkgField: 'power_wkg15', label: '15s' },
    { seconds: 30, field: 'power_w30', wkgField: 'power_wkg30', label: '30s' },
    { seconds: 60, field: 'power_w60', wkgField: 'power_wkg60', label: '1m' },
    { seconds: 120, field: 'power_w120', wkgField: 'power_wkg120', label: '2m' },
    { seconds: 300, field: 'power_w300', wkgField: 'power_wkg300', label: '5m' },
    { seconds: 1200, field: 'power_w1200', wkgField: 'power_wkg1200', label: '20m' }
];

/**
 * Generate a consistent color from a string (team name)
 */
function stringToColor(str) {
    if (!str) return '#888888';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Format duration in seconds to readable label
 */
function formatDurationLabel(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
}

/**
 * Render the power bubble chart
 */
function renderPowerBubbleChart() {
    const chartContainer = document.getElementById('power-bubble-chart');
    const chartSection = document.getElementById('chart-section');
    if (!chartContainer || !chartSection) return;

    // Collect data from entrants
    const teamData = {};  // { teamName: { color: string, data: [] } }

    for (const entrant of currentEntrants) {
        const athleteId = entrant.id || entrant.athleteId;
        const athleteData = storedAthleteData[athleteId];

        // Skip athletes without imported data
        if (!athleteData) continue;

        // Get team name (fallback to 'No Team')
        const team = athleteData.team ||
                     entrant.team ||
                     'No Team';

        // Get athlete name
        const name = athleteData.name || getEntrantName(entrant);

        // Initialize team if not exists
        if (!teamData[team]) {
            teamData[team] = {
                color: stringToColor(team),
                data: []
            };
        }

        // Add data point for each power duration that has data
        for (const duration of CHART_POWER_DURATIONS) {
            const watts = athleteData[duration.field];
            let wkg = athleteData[duration.wkgField];

            // Skip if no watts data
            if (!watts || watts <= 0) continue;

            // Calculate wkg if not available but we have weight
            if (!wkg && athleteData.weight && athleteData.weight > 0) {
                wkg = watts / athleteData.weight;
            }

            // Default wkg to a small value if still not available
            if (!wkg || wkg <= 0) wkg = 1;

            teamData[team].data.push({
                x: duration.seconds,
                y: Math.round(watts),
                z: parseFloat(wkg.toFixed(2)),
                meta: {
                    name: name,
                    duration: duration.label
                }
            });
        }
    }

    // Convert to ApexCharts series format
    const series = Object.entries(teamData)
        .filter(([_, data]) => data.data.length > 0)
        .map(([team, data]) => ({
            name: team,
            data: data.data
        }));

    // Hide chart if no data
    if (series.length === 0) {
        chartSection.hidden = true;
        return;
    }

    chartSection.hidden = false;

    // Generate colors array matching series order
    const colors = Object.entries(teamData)
        .filter(([_, data]) => data.data.length > 0)
        .map(([_, data]) => data.color);

    const chartOptions = {
        chart: {
            type: 'bubble',
            height: 450,
            background: 'transparent',
            foreColor: '#ccc',
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            },
            animations: {
                enabled: true,
                speed: 400
            }
        },
        theme: {
            mode: 'dark'
        },
        colors: colors,
        series: series,
        xaxis: {
            type: 'numeric',
            title: {
                text: 'Duration',
                style: { color: '#aaa' }
            },
            min: 3,
            max: 1500,
            tickAmount: 7,
            labels: {
                formatter: (val) => formatDurationLabel(Math.round(val))
            },
            logarithmic: true
        },
        yaxis: {
            title: {
                text: 'Power (watts)',
                style: { color: '#aaa' }
            },
            min: 0,
            labels: {
                formatter: (val) => Math.round(val)
            }
        },
        tooltip: {
            enabled: true,
            custom: function({ seriesIndex, dataPointIndex, w }) {
                const point = w.config.series[seriesIndex].data[dataPointIndex];
                const teamName = w.config.series[seriesIndex].name;
                return `
                    <div class="apex-tooltip-custom">
                        <div class="tooltip-title">${point.meta.name}</div>
                        <div class="tooltip-team">${teamName}</div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">Duration:</span>
                            <span class="tooltip-value">${point.meta.duration}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">Power:</span>
                            <span class="tooltip-value">${point.y} W</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">W/kg:</span>
                            <span class="tooltip-value">${point.z.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            }
        },
        fill: {
            opacity: 0.7
        },
        plotOptions: {
            bubble: {
                minBubbleRadius: 4,
                maxBubbleRadius: 30
            }
        },
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'left',
            floating: false,
            labels: {
                colors: '#ccc'
            }
        },
        grid: {
            borderColor: '#444',
            xaxis: {
                lines: { show: true }
            },
            yaxis: {
                lines: { show: true }
            }
        },
        dataLabels: {
            enabled: false
        }
    };

    // Destroy existing chart if exists
    if (powerBubbleChart) {
        powerBubbleChart.destroy();
    }

    // Create new chart
    powerBubbleChart = new ApexCharts(chartContainer, chartOptions);
    powerBubbleChart.render();
}

/**
 * Setup chart refresh button
 */
function setupChartControls() {
    const refreshBtn = document.getElementById('refresh-chart-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            renderPowerBubbleChart();
        });
    }
}

// Event Viewer column configuration
const EVENT_VIEWER_COLUMNS_KEY = '/hr-zone-monitor-event-columns';
const EVENT_VIEWER_SORT_KEY = '/hr-zone-monitor-event-sort';

// Available columns for Event Viewer
const AVAILABLE_COLUMNS = [
    // Basic info
    { id: 'name', label: 'Name', type: 'text', getValue: (e, data) => getEntrantName(e), editable: false },
    { id: 'team', label: 'Team', type: 'text', getValue: (e, data) => data?.team || e.team || '', editable: true, storageKey: 'team' },
    { id: 'country', label: 'Country', type: 'text', getValue: (e, data) => data?.country || '', editable: false },
    { id: 'gender', label: 'Gender', type: 'text', getValue: (e, data) => data?.gender || '', editable: false },
    { id: 'maxHR', label: 'Max HR', type: 'number', getValue: (e, data) => data?.maxHR || '', editable: true, min: 100, max: 250 },
    { id: 'weight', label: 'Weight', type: 'number', getValue: (e, data) => data?.weight || '', suffix: 'kg', editable: false },
    { id: 'height', label: 'Height', type: 'number', getValue: (e, data) => data?.height || '', suffix: 'cm', editable: false },

    // Category & FTP
    { id: 'zpCategory', label: 'Category', type: 'text', getValue: (e, data) => data?.zpCategory || '', editable: false },
    { id: 'zpFTP', label: 'FTP', type: 'number', getValue: (e, data) => data?.zpFTP || '', suffix: 'W', editable: false },

    // Critical Power model
    { id: 'power_CP', label: 'CP', type: 'number', getValue: (e, data) => data?.power_CP || '', suffix: 'W', editable: false },
    { id: 'power_AWC', label: "W'", type: 'number', getValue: (e, data) => data?.power_AWC || '', suffix: 'J', editable: false },

    // Power durations (watts)
    { id: 'power_w5', label: '5s', type: 'number', getValue: (e, data) => data?.power_w5 || '', suffix: 'W', editable: true, powerSeconds: 5 },
    { id: 'power_w15', label: '15s', type: 'number', getValue: (e, data) => data?.power_w15 || '', suffix: 'W', editable: true, powerSeconds: 15 },
    { id: 'power_w30', label: '30s', type: 'number', getValue: (e, data) => data?.power_w30 || '', suffix: 'W', editable: true, powerSeconds: 30 },
    { id: 'power_w60', label: '1m', type: 'number', getValue: (e, data) => data?.power_w60 || '', suffix: 'W', editable: true, powerSeconds: 60 },
    { id: 'power_w120', label: '2m', type: 'number', getValue: (e, data) => data?.power_w120 || '', suffix: 'W', editable: true, powerSeconds: 120 },
    { id: 'power_w300', label: '5m', type: 'number', getValue: (e, data) => data?.power_w300 || '', suffix: 'W', editable: true, powerSeconds: 300 },
    { id: 'power_w1200', label: '20m', type: 'number', getValue: (e, data) => data?.power_w1200 || '', suffix: 'W', editable: true, powerSeconds: 1200 },

    // Power durations (w/kg)
    { id: 'power_wkg5', label: '5s W/kg', type: 'number', getValue: (e, data) => data?.power_wkg5 ? data.power_wkg5.toFixed(2) : '', suffix: '', editable: false },
    { id: 'power_wkg15', label: '15s W/kg', type: 'number', getValue: (e, data) => data?.power_wkg15 ? data.power_wkg15.toFixed(2) : '', suffix: '', editable: false },
    { id: 'power_wkg30', label: '30s W/kg', type: 'number', getValue: (e, data) => data?.power_wkg30 ? data.power_wkg30.toFixed(2) : '', suffix: '', editable: false },
    { id: 'power_wkg60', label: '1m W/kg', type: 'number', getValue: (e, data) => data?.power_wkg60 ? data.power_wkg60.toFixed(2) : '', suffix: '', editable: false },
    { id: 'power_wkg120', label: '2m W/kg', type: 'number', getValue: (e, data) => data?.power_wkg120 ? data.power_wkg120.toFixed(2) : '', suffix: '', editable: false },
    { id: 'power_wkg300', label: '5m W/kg', type: 'number', getValue: (e, data) => data?.power_wkg300 ? data.power_wkg300.toFixed(2) : '', suffix: '', editable: false },
    { id: 'power_wkg1200', label: '20m W/kg', type: 'number', getValue: (e, data) => data?.power_wkg1200 ? data.power_wkg1200.toFixed(2) : '', suffix: '', editable: false },

    // Power ratings
    { id: 'power_powerRating', label: 'Power Rating', type: 'number', getValue: (e, data) => data?.power_powerRating || '', suffix: '', editable: false },
    { id: 'power_compoundScore', label: 'Compound Score', type: 'number', getValue: (e, data) => data?.power_compoundScore || '', suffix: '', editable: false },

    // Phenotype
    { id: 'phenotype_value', label: 'Phenotype', type: 'text', getValue: (e, data) => data?.phenotype_value || '', editable: false },
    { id: 'phenotype_bias', label: 'Pheno Bias', type: 'number', getValue: (e, data) => data?.phenotype_bias ? data.phenotype_bias.toFixed(2) : '', suffix: '', editable: false },
    { id: 'phenotype_scores_sprinter', label: 'Sprinter', type: 'number', getValue: (e, data) => data?.phenotype_scores_sprinter ? data.phenotype_scores_sprinter.toFixed(1) : '', suffix: '', editable: false },
    { id: 'phenotype_scores_puncheur', label: 'Puncheur', type: 'number', getValue: (e, data) => data?.phenotype_scores_puncheur ? data.phenotype_scores_puncheur.toFixed(1) : '', suffix: '', editable: false },
    { id: 'phenotype_scores_pursuiter', label: 'Pursuiter', type: 'number', getValue: (e, data) => data?.phenotype_scores_pursuiter ? data.phenotype_scores_pursuiter.toFixed(1) : '', suffix: '', editable: false },
    { id: 'phenotype_scores_tt', label: 'TT', type: 'number', getValue: (e, data) => data?.phenotype_scores_tt ? data.phenotype_scores_tt.toFixed(1) : '', suffix: '', editable: false },
    { id: 'phenotype_scores_climber', label: 'Climber', type: 'number', getValue: (e, data) => data?.phenotype_scores_climber ? data.phenotype_scores_climber.toFixed(1) : '', suffix: '', editable: false },

    // Handicaps (profile suitability)
    { id: 'handicaps_profile_flat', label: 'Flat %', type: 'number', getValue: (e, data) => data?.handicaps_profile_flat ? (data.handicaps_profile_flat * 100).toFixed(1) : '', suffix: '%', editable: false },
    { id: 'handicaps_profile_rolling', label: 'Rolling %', type: 'number', getValue: (e, data) => data?.handicaps_profile_rolling ? (data.handicaps_profile_rolling * 100).toFixed(1) : '', suffix: '%', editable: false },
    { id: 'handicaps_profile_hilly', label: 'Hilly %', type: 'number', getValue: (e, data) => data?.handicaps_profile_hilly ? (data.handicaps_profile_hilly * 100).toFixed(1) : '', suffix: '%', editable: false },
    { id: 'handicaps_profile_mountainous', label: 'Mountain %', type: 'number', getValue: (e, data) => data?.handicaps_profile_mountainous ? (data.handicaps_profile_mountainous * 100).toFixed(1) : '', suffix: '%', editable: false },

    // Race stats
    { id: 'race_finishes', label: 'Finishes', type: 'number', getValue: (e, data) => data?.race_finishes || '', suffix: '', editable: false },
    { id: 'race_wins', label: 'Wins', type: 'number', getValue: (e, data) => data?.race_wins || '', suffix: '', editable: false },
    { id: 'race_podiums', label: 'Podiums', type: 'number', getValue: (e, data) => data?.race_podiums || '', suffix: '', editable: false },
    { id: 'race_dnfs', label: 'DNFs', type: 'number', getValue: (e, data) => data?.race_dnfs || '', suffix: '', editable: false },

    // Race rankings - Current
    { id: 'race_current_rating', label: 'Current Rating', type: 'number', getValue: (e, data) => data?.race_current_rating || '', suffix: '', editable: false },
    { id: 'race_current_mixed_category', label: 'Current Cat', type: 'text', getValue: (e, data) => data?.race_current_mixed_category || '', editable: false },
    { id: 'race_current_mixed_number', label: 'Current #', type: 'number', getValue: (e, data) => data?.race_current_mixed_number || '', suffix: '', editable: false },

    // Race rankings - Max 30 days
    { id: 'race_max30_rating', label: 'Max30 Rating', type: 'number', getValue: (e, data) => data?.race_max30_rating || '', suffix: '', editable: false },
    { id: 'race_max30_mixed_category', label: 'Max30 Cat', type: 'text', getValue: (e, data) => data?.race_max30_mixed_category || '', editable: false },

    // Race rankings - Max 90 days
    { id: 'race_max90_rating', label: 'Max90 Rating', type: 'number', getValue: (e, data) => data?.race_max90_rating || '', suffix: '', editable: false },
    { id: 'race_max90_mixed_category', label: 'Max90 Cat', type: 'text', getValue: (e, data) => data?.race_max90_mixed_category || '', editable: false }
];

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS = ['name', 'team', 'zpCategory', 'zpFTP', 'power_w60', 'power_w300', 'power_w1200'];

// Current sort state
let eventViewerSort = { column: 'name', ascending: true };
let visibleEventColumns = [...DEFAULT_VISIBLE_COLUMNS];

// Storage key for GOTTA.BIKE authentication
const GOTTA_AUTH_KEY = '/gotta-bike-sauce-auth';
const GOTTA_API_URL = 'https://app.gotta.bike';

/**
 * Setup zone color preview boxes to match current colors
 */
function setupZoneColorPreviews() {
    const settings = common.settingsStore.get();

    // Update HR zone previews
    for (let i = 1; i <= 5; i++) {
        const preview = document.getElementById(`hr-zone${i}-preview`);
        const input = document.querySelector(`input[name="hrZone${i}Color"]`);
        if (preview && input) {
            const color = settings[`hrZone${i}Color`] || DEFAULT_ZONE_COLORS[`zone${i}`];
            preview.style.backgroundColor = color;
            input.value = color;
            // Update preview when color changes
            input.addEventListener('input', () => {
                preview.style.backgroundColor = input.value;
            });
        }
    }

    // Update Power zone previews
    for (let i = 1; i <= 5; i++) {
        const preview = document.getElementById(`power-zone${i}-preview`);
        const input = document.querySelector(`input[name="powerZone${i}Color"]`);
        if (preview && input) {
            const color = settings[`powerZone${i}Color`] || DEFAULT_ZONE_COLORS[`zone${i}`];
            preview.style.backgroundColor = color;
            input.value = color;
            // Update preview when color changes
            input.addEventListener('input', () => {
                preview.style.backgroundColor = input.value;
            });
        }
    }
}

/**
 * Setup reset buttons for zone colors
 */
function setupZoneColorResetButtons() {
    const resetHrBtn = document.getElementById('reset-hr-colors');
    const resetPowerBtn = document.getElementById('reset-power-colors');

    if (resetHrBtn) {
        resetHrBtn.addEventListener('click', () => {
            for (let i = 1; i <= 5; i++) {
                const input = document.querySelector(`input[name="hrZone${i}Color"]`);
                const preview = document.getElementById(`hr-zone${i}-preview`);
                const defaultColor = DEFAULT_ZONE_COLORS[`zone${i}`];
                if (input) {
                    input.value = defaultColor;
                    // Trigger change event to save to settings
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (preview) {
                    preview.style.backgroundColor = defaultColor;
                }
            }
        });
    }

    if (resetPowerBtn) {
        resetPowerBtn.addEventListener('click', () => {
            for (let i = 1; i <= 5; i++) {
                const input = document.querySelector(`input[name="powerZone${i}Color"]`);
                const preview = document.getElementById(`power-zone${i}-preview`);
                const defaultColor = DEFAULT_ZONE_COLORS[`zone${i}`];
                if (input) {
                    input.value = defaultColor;
                    // Trigger change event to save to settings
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (preview) {
                    preview.style.backgroundColor = defaultColor;
                }
            }
        });
    }
}

function renderAthleteMaxListWithCurrentSearch() {
    const searchInput = document.getElementById('athlete-search');
    const currentFilter = searchInput ? searchInput.value : '';
    renderAthleteMaxList(currentFilter);
}

// ============================================================================
// GOTTA.BIKE Authentication
// ============================================================================

/**
 * Setup GOTTA.BIKE authentication handlers
 */
function setupGottaBikeAuth() {
    const usernameInput = document.getElementById('gotta-username');
    const passwordInput = document.getElementById('gotta-password');
    const authBtn = document.getElementById('gotta-auth-btn');
    const statusSpan = document.getElementById('gotta-auth-status');
    const authInfoDiv = document.getElementById('gotta-auth-info');

    if (!usernameInput || !passwordInput || !authBtn) return;

    // Check if we already have saved auth data
    const savedAuth = common.settingsStore.get(GOTTA_AUTH_KEY);

    // Load saved username
    if (savedAuth?.username && usernameInput) {
        usernameInput.value = savedAuth.username;
    }

    // Display auth status if we have a valid token
    if (savedAuth?.api_key) {
        displayGottaAuthStatus(savedAuth);
    }

    // Authenticate button handler
    authBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            setGottaAuthStatus('error', 'Please enter both email and password');
            return;
        }

        // Save username locally (even before auth succeeds)
        const currentAuth = common.settingsStore.get(GOTTA_AUTH_KEY) || {};
        currentAuth.username = username;
        common.settingsStore.set(GOTTA_AUTH_KEY, currentAuth);

        // Show loading state
        authBtn.disabled = true;
        authBtn.textContent = 'Authenticating...';
        setGottaAuthStatus('loading', 'Connecting to GOTTA.BIKE...');

        try {
            const response = await fetch(`${GOTTA_API_URL}/api_v1/zrapp/sauce_auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (data.success && data.api_key) {
                // Calculate expiration date (30 days from now)
                const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

                // Save the auth data
                const authData = {
                    api_key: data.api_key,
                    zwid: data.zwid,
                    username: username,
                    authenticated_at: Date.now(),
                    expires_at: expiresAt
                };
                common.settingsStore.set(GOTTA_AUTH_KEY, authData);

                // Clear password field for security
                passwordInput.value = '';

                setGottaAuthStatus('success', data.message || 'Authentication successful!');
                displayGottaAuthStatus(authData);
            } else {
                setGottaAuthStatus('error', data.message || 'Authentication failed');
                if (authInfoDiv) {
                    authInfoDiv.hidden = true;
                }
            }
        } catch (error) {
            console.error('GOTTA.BIKE auth error:', error);
            setGottaAuthStatus('error', `Connection failed: ${error.message}`);
            if (authInfoDiv) {
                authInfoDiv.hidden = true;
            }
        } finally {
            authBtn.disabled = false;
            authBtn.textContent = 'Authenticate';
        }
    });
}

/**
 * Set the authentication status message
 */
function setGottaAuthStatus(state, message) {
    const statusSpan = document.getElementById('gotta-auth-status');
    if (!statusSpan) return;

    statusSpan.className = 'gotta-auth-status-msg ' + state;
    statusSpan.textContent = message;
}

/**
 * Display authentication info when already authenticated
 */
function displayGottaAuthStatus(authData) {
    const authInfoDiv = document.getElementById('gotta-auth-info');
    const statusText = document.getElementById('gotta-status-text');
    const zwidSpan = document.getElementById('gotta-zwid');
    const expiresSpan = document.getElementById('gotta-expires');
    const keyPreviewSpan = document.getElementById('gotta-key-preview');
    const usernameInput = document.getElementById('gotta-username');

    if (!authInfoDiv) return;

    // Show the auth info section
    authInfoDiv.hidden = false;

    if (statusText) {
        statusText.textContent = 'Authenticated';
        statusText.className = 'gotta-value authenticated';
    }

    if (zwidSpan && authData.zwid) {
        zwidSpan.textContent = authData.zwid;
    }

    // Display expiration date
    if (expiresSpan && authData.expires_at) {
        const expiresDate = new Date(authData.expires_at);
        expiresSpan.textContent = expiresDate.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Check if expired
        if (Date.now() > authData.expires_at) {
            expiresSpan.textContent += ' (Expired)';
            expiresSpan.className = 'gotta-value expired';
            if (statusText) {
                statusText.textContent = 'Expired';
                statusText.className = 'gotta-value expired';
            }
        }
    }

    // Display last 6 characters of API key
    if (keyPreviewSpan && authData.api_key) {
        const keyLast6 = authData.api_key.slice(-6);
        keyPreviewSpan.textContent = `...${keyLast6}`;
    }

    // Pre-fill username if available
    if (usernameInput && authData.username) {
        usernameInput.value = authData.username;
    }
}

/**
 * Setup GOTTA.BIKE athlete lookup
 */
function setupGottaAthleteLookup() {
    const athleteIdInput = document.getElementById('gotta-athlete-id');
    const lookupBtn = document.getElementById('gotta-lookup-btn');
    const statusDiv = document.getElementById('gotta-lookup-status');
    const dataDiv = document.getElementById('gotta-athlete-data');

    if (!athleteIdInput || !lookupBtn) return;

    lookupBtn.addEventListener('click', async () => {
        const athleteId = parseInt(athleteIdInput.value);

        if (!athleteId || athleteId < 1) {
            setGottaLookupStatus('error', 'Please enter a valid Athlete ID');
            return;
        }

        // Get auth data
        const authData = common.settingsStore.get(GOTTA_AUTH_KEY);
        if (!authData?.api_key) {
            setGottaLookupStatus('error', 'Please authenticate first');
            return;
        }

        // Check if token is expired
        if (authData.expires_at && Date.now() > authData.expires_at) {
            setGottaLookupStatus('error', 'API key expired. Please re-authenticate.');
            return;
        }

        // Show loading state
        lookupBtn.disabled = true;
        lookupBtn.textContent = 'Looking up...';
        setGottaLookupStatus('loading', 'Fetching athlete data...');
        if (dataDiv) dataDiv.hidden = true;

        try {
            const response = await fetch(`${GOTTA_API_URL}/api_v1/zrapp/riders_sauce_mod`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sauce-API-Key': authData.api_key
                },
                body: JSON.stringify({
                    rider_ids: [athleteId]
                })
            });

            const data = await response.json();

            if (response.ok && data) {
                displayGottaAthleteData(athleteId, data);
                setGottaLookupStatus('success', 'Data retrieved successfully');
            } else {
                setGottaLookupStatus('error', data.message || data.error || 'Failed to fetch athlete data');
            }
        } catch (error) {
            console.error('GOTTA.BIKE lookup error:', error);
            setGottaLookupStatus('error', `Connection failed: ${error.message}`);
        } finally {
            lookupBtn.disabled = false;
            lookupBtn.textContent = 'Lookup';
        }
    });
}

/**
 * Set the lookup status message
 */
function setGottaLookupStatus(state, message) {
    const statusDiv = document.getElementById('gotta-lookup-status');
    if (!statusDiv) return;

    statusDiv.className = 'gotta-lookup-status ' + state;

    if (state === 'loading') {
        statusDiv.innerHTML = `<span class="spinner-inline"></span> ${message}`;
    } else {
        statusDiv.textContent = message;
    }
}

/**
 * Display athlete data from GOTTA.BIKE and import to storage
 */
function displayGottaAthleteData(athleteId, data) {
    const dataDiv = document.getElementById('gotta-athlete-data');
    if (!dataDiv) return;

    // The API returns { riders: [...] }
    const riders = data.riders || [];
    const athlete = riders[0];

    if (!athlete) {
        dataDiv.innerHTML = '<p class="no-data">No data found for this athlete.</p>';
        dataDiv.hidden = false;
        return;
    }

    // Import the athlete data to storage
    importGottaAthleteData(athlete);
    saveStoredAthleteData();
    saveStoredMaxPowerData();
    saveStoredMaxHRData();

    // Build display HTML
    let html = '<div class="gotta-athlete-profile">';

    // Basic info section
    html += '<div class="gotta-section-title">Basic Info</div>';
    const basicFields = [
        { key: 'riderId', label: 'Rider ID' },
        { key: 'name', label: 'Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'country', label: 'Country' },
        { key: 'height', label: 'Height', suffix: 'cm' },
        { key: 'weight', label: 'Weight', suffix: 'kg' }
    ];

    for (const field of basicFields) {
        const value = athlete[field.key];
        if (value !== undefined && value !== null && value !== '') {
            let displayValue = value;
            if (typeof value === 'number' && field.suffix) {
                displayValue = `${value.toFixed(1)} ${field.suffix}`;
            } else if (field.suffix) {
                displayValue = `${value} ${field.suffix}`;
            }
            html += `
                <div class="gotta-athlete-row">
                    <span class="gotta-label">${field.label}:</span>
                    <span class="gotta-value">${displayValue}</span>
                </div>
            `;
        }
    }

    // Racing category section
    html += '<div class="gotta-section-title">Racing Data</div>';
    const zpFields = [
        { key: 'zpCategory', label: 'Category' },
        { key: 'zpFTP', label: 'FTP', suffix: 'W' }
    ];

    for (const field of zpFields) {
        const value = athlete[field.key];
        if (value !== undefined && value !== null && value !== '') {
            let displayValue = value;
            if (typeof value === 'number' && field.suffix) {
                displayValue = `${value.toFixed(0)} ${field.suffix}`;
            }
            html += `
                <div class="gotta-athlete-row">
                    <span class="gotta-label">${field.label}:</span>
                    <span class="gotta-value">${displayValue}</span>
                </div>
            `;
        }
    }

    // Power Model section
    html += '<div class="gotta-section-title">Power Model</div>';
    const powerModelFields = [
        { key: 'power_CP', label: 'Critical Power (CP)', suffix: 'W' },
        { key: 'power_AWC', label: "W' (AWC)", suffix: 'J' }
    ];

    for (const field of powerModelFields) {
        const value = athlete[field.key];
        if (value !== undefined && value !== null && value !== '' && value > 0) {
            let displayValue = `${Math.round(value)} ${field.suffix}`;
            html += `
                <div class="gotta-athlete-row">
                    <span class="gotta-label">${field.label}:</span>
                    <span class="gotta-value">${displayValue}</span>
                </div>
            `;
        }
    }

    // Power Bests section
    html += '<div class="gotta-section-title">Power Bests</div>';
    const powerBestFields = [
        { key: 'power_w5', label: '5 sec', suffix: 'W' },
        { key: 'power_w15', label: '15 sec', suffix: 'W' },
        { key: 'power_w60', label: '1 min', suffix: 'W' },
        { key: 'power_w300', label: '5 min', suffix: 'W' },
        { key: 'power_w1200', label: '20 min', suffix: 'W' }
    ];

    for (const field of powerBestFields) {
        const value = athlete[field.key];
        if (value !== undefined && value !== null && value !== '' && value > 0) {
            let displayValue = `${Math.round(value)} ${field.suffix}`;
            html += `
                <div class="gotta-athlete-row">
                    <span class="gotta-label">${field.label}:</span>
                    <span class="gotta-value">${displayValue}</span>
                </div>
            `;
        }
    }

    // Metadata
    if (athlete.modified) {
        html += '<div class="gotta-section-title">Metadata</div>';
        html += `
            <div class="gotta-athlete-row">
                <span class="gotta-label">Last Updated:</span>
                <span class="gotta-value">${athlete.modified}</span>
            </div>
        `;
    }

    html += '</div>';

    // Add import confirmation
    html += '<div class="gotta-import-status">Data imported to athlete storage</div>';

    // Add raw data viewer
    html += `
        <details class="gotta-raw-data">
            <summary>View Raw Data</summary>
            <pre>${JSON.stringify(athlete, null, 2)}</pre>
        </details>
    `;

    dataDiv.innerHTML = html;
    dataDiv.hidden = false;
}

function setupBackgroundOptionToggle() {
    const bgSelect = document.querySelector('select[name="backgroundOption"]');
    const customColorRow = document.querySelector('.custom-color-row');

    if (!bgSelect || !customColorRow) return;

    function updateCustomColorVisibility() {
        if (bgSelect.value === 'custom') {
            customColorRow.classList.add('visible');
        } else {
            customColorRow.classList.remove('visible');
        }
    }

    // Set initial state
    updateCustomColorVisibility();

    // Listen for changes
    bgSelect.addEventListener('change', updateCustomColorVisibility);
}

function setupAthleteSearch() {
    const searchInput = document.getElementById('athlete-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (ev) => {
        renderAthleteMaxList(ev.target.value);
    });
}

function renderAthleteMaxList(searchFilter = '') {
    const container = document.getElementById('athlete-max-list');
    if (!container) return;

    container.innerHTML = '';

    // Get all athlete IDs from storedAthleteData
    let allAthleteIds = Object.keys(storedAthleteData)
        .map(Number)
        .filter(id => !isNaN(id));

    // Apply search filter
    if (searchFilter) {
        const filterLower = searchFilter.toLowerCase();
        allAthleteIds = allAthleteIds.filter(athleteId => {
            const data = storedAthleteData[athleteId] || {};
            const name = data.name || '';
            const team = data.team || '';
            const idStr = String(athleteId);
            return name.toLowerCase().includes(filterLower) ||
                   team.toLowerCase().includes(filterLower) ||
                   idStr.includes(filterLower);
        });
    }

    // Add header row (team column always visible in settings)
    const headerRow = document.createElement('div');
    headerRow.className = 'athlete-max-row athlete-max-header';
    headerRow.innerHTML = `
        <div class="athlete-info"><span class="header-label">Athlete</span></div>
        <span class="header-label team-header">Team</span>
        <span class="header-label hr-header">HR</span>
        <div class="power-inputs header-power">
            ${POWER_COLUMNS.map(col => `<span class="header-label">${col.label}</span>`).join('')}
        </div>
        <span class="header-label update-header"></span>
        <span class="header-label expand-header"></span>
        <span class="header-label delete-header"></span>
    `;
    container.appendChild(headerRow);

    if (allAthleteIds.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'no-riders';
        emptyMsg.textContent = searchFilter
            ? 'No athletes match your search.'
            : 'No athlete data yet. Import from GOTTA.BIKE or add manually below.';
        container.appendChild(emptyMsg);
        return;
    }

    for (const athleteId of allAthleteIds) {
        const athleteData = storedAthleteData[athleteId] || {};
        const name = athleteData.name || `Athlete ${athleteId}`;
        const team = athleteData.team || '';
        const maxHR = athleteData.maxHR || '';

        const row = document.createElement('div');
        row.className = 'athlete-max-row';

        // Name, team, and ID info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'athlete-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'athlete-name';
        nameSpan.textContent = name;
        infoDiv.appendChild(nameSpan);

        const metaSpan = document.createElement('span');
        metaSpan.className = 'athlete-meta';
        const metaParts = [];
        if (team) metaParts.push(team);
        metaParts.push(`ID: ${athleteId}`);
        metaSpan.textContent = metaParts.join(' · ');
        infoDiv.appendChild(metaSpan);

        // Team input (always visible in settings)
        const teamInput = document.createElement('input');
        teamInput.type = 'text';
        teamInput.className = 'team-input';
        teamInput.value = team;
        teamInput.placeholder = 'Team';
        teamInput.title = 'Team name';
        teamInput.addEventListener('change', (ev) => {
            const newTeam = ev.target.value.trim();
            const data = storedAthleteData[athleteId] || {};
            storedAthleteData[athleteId] = {
                ...data,
                team: newTeam || null,
                userEdited: { ...(data.userEdited || {}), team: !!newTeam }
            };
            saveStoredAthleteData();
            // Update the meta span to reflect the change
            const metaParts = [];
            if (newTeam) metaParts.push(newTeam);
            metaParts.push(`ID: ${athleteId}`);
            metaSpan.textContent = metaParts.join(' · ');
        });

        // Max HR input
        const hrInput = document.createElement('input');
        hrInput.type = 'number';
        hrInput.className = 'max-value-input';
        hrInput.value = maxHR;
        hrInput.min = 100;
        hrInput.max = 250;
        hrInput.placeholder = 'HR';
        hrInput.title = 'Max HR';
        hrInput.addEventListener('change', (ev) => {
            const newMaxHR = parseInt(ev.target.value);
            const data = storedAthleteData[athleteId] || {};
            if (newMaxHR >= 100 && newMaxHR <= 250) {
                storedAthleteData[athleteId] = {
                    ...data,
                    maxHR: Math.round(newMaxHR),
                    userEdited: { ...(data.userEdited || {}), maxHR: true }
                };
                saveStoredAthleteData();
            } else if (ev.target.value === '') {
                storedAthleteData[athleteId] = {
                    ...data,
                    maxHR: null,
                    userEdited: { ...(data.userEdited || {}), maxHR: false }
                };
                saveStoredAthleteData();
            }
        });

        // Power inputs container
        const powerInputs = document.createElement('div');
        powerInputs.className = 'power-inputs';

        for (const col of POWER_COLUMNS) {
            const powerValue = athleteData[col.key] || '';
            const powerInput = document.createElement('input');
            powerInput.type = 'number';
            powerInput.className = 'max-value-input power-input';
            powerInput.value = powerValue ? Math.round(powerValue) : '';
            powerInput.min = 0;
            powerInput.max = 2500;
            powerInput.placeholder = col.label;
            powerInput.title = `Max ${col.label} power`;
            powerInput.addEventListener('change', (ev) => {
                const newPower = parseInt(ev.target.value);
                const data = storedAthleteData[athleteId] || {};
                storedAthleteData[athleteId] = {
                    ...data,
                    [col.key]: newPower > 0 ? Math.round(newPower) : null
                };
                saveStoredAthleteData();
            });
            powerInputs.appendChild(powerInput);
        }

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<ms>delete</ms>';
        deleteBtn.title = 'Delete all data for this athlete';
        deleteBtn.addEventListener('click', () => {
            delete storedAthleteData[athleteId];
            saveStoredAthleteData();
            renderAthleteMaxList();
        });

        // Expand button to show all data
        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<ms>expand_more</ms>';
        expandBtn.title = 'Show all data';

        // Create expandable details panel
        const detailsPanel = document.createElement('div');
        detailsPanel.className = 'athlete-details-panel';
        detailsPanel.hidden = true;

        // Check if we have GOTTA.BIKE data
        const gottaData = storedAthleteData[athleteId];
        if (gottaData) {
            detailsPanel.innerHTML = renderAthleteDetailsPanel(athleteId, gottaData);
        } else {
            detailsPanel.innerHTML = '<div class="no-gotta-data">No extended data available. Import from GOTTA.BIKE to see additional fields.</div>';
        }

        expandBtn.addEventListener('click', () => {
            const isExpanded = !detailsPanel.hidden;
            detailsPanel.hidden = isExpanded;
            expandBtn.innerHTML = isExpanded ? '<ms>expand_more</ms>' : '<ms>expand_less</ms>';
            expandBtn.title = isExpanded ? 'Show all data' : 'Hide details';
        });

        row.appendChild(infoDiv);
        row.appendChild(teamInput);
        row.appendChild(hrInput);
        row.appendChild(powerInputs);
        row.appendChild(expandBtn);
        row.appendChild(deleteBtn);

        // Create a wrapper to hold both the row and the details panel
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'athlete-row-wrapper';
        rowWrapper.appendChild(row);
        rowWrapper.appendChild(detailsPanel);

        container.appendChild(rowWrapper);
    }
}

/**
 * Render the details panel HTML for an athlete
 */
function renderAthleteDetailsPanel(athleteId, data) {
    // Helper to render a section
    function renderSection(title, fields) {
        let sectionHtml = '';
        let hasContent = false;

        for (const field of fields) {
            const value = data[field.key];
            if (value !== undefined && value !== null && value !== '' && value !== 0) {
                hasContent = true;
                let displayValue = value;
                if (typeof value === 'number') {
                    if (field.decimals !== undefined) {
                        displayValue = value.toFixed(field.decimals);
                    } else if (field.round) {
                        displayValue = Math.round(value);
                    }
                }
                if (field.suffix) {
                    displayValue += ` ${field.suffix}`;
                }
                sectionHtml += `<div class="details-item"><span class="details-label">${field.label}:</span><span class="details-value">${displayValue}</span></div>`;
            }
        }

        if (!hasContent) return '';
        return `<div class="details-section"><div class="details-section-title">${title}</div><div class="details-grid">${sectionHtml}</div></div>`;
    }

    let html = '<div class="athlete-details-content">';

    // Basic Info
    html += renderSection('Basic Info', [
        { key: 'riderId', label: 'Rider ID' },
        { key: 'name', label: 'Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'country', label: 'Country' },
        { key: 'height', label: 'Height', suffix: 'cm', decimals: 1 },
        { key: 'weight', label: 'Weight', suffix: 'kg', decimals: 1 }
    ]);

    // Category & FTP
    html += renderSection('Category & FTP', [
        { key: 'zpCategory', label: 'Category' },
        { key: 'zpFTP', label: 'FTP', suffix: 'W', round: true }
    ]);

    // Power Model
    html += renderSection('Power Model', [
        { key: 'power_CP', label: 'Critical Power', suffix: 'W', round: true },
        { key: 'power_AWC', label: "W' (AWC)", suffix: 'J', round: true },
        { key: 'power_powerRating', label: 'Power Rating', decimals: 1 },
        { key: 'power_compoundScore', label: 'Compound Score', decimals: 1 }
    ]);

    // Power Bests (Watts)
    html += renderSection('Power Bests (Watts)', [
        { key: 'power_w5', label: '5 sec', suffix: 'W', round: true },
        { key: 'power_w15', label: '15 sec', suffix: 'W', round: true },
        { key: 'power_w30', label: '30 sec', suffix: 'W', round: true },
        { key: 'power_w60', label: '1 min', suffix: 'W', round: true },
        { key: 'power_w120', label: '2 min', suffix: 'W', round: true },
        { key: 'power_w300', label: '5 min', suffix: 'W', round: true },
        { key: 'power_w1200', label: '20 min', suffix: 'W', round: true }
    ]);

    // Power Bests (W/kg)
    html += renderSection('Power Bests (W/kg)', [
        { key: 'power_wkg5', label: '5 sec', suffix: 'W/kg', decimals: 2 },
        { key: 'power_wkg15', label: '15 sec', suffix: 'W/kg', decimals: 2 },
        { key: 'power_wkg30', label: '30 sec', suffix: 'W/kg', decimals: 2 },
        { key: 'power_wkg60', label: '1 min', suffix: 'W/kg', decimals: 2 },
        { key: 'power_wkg120', label: '2 min', suffix: 'W/kg', decimals: 2 },
        { key: 'power_wkg300', label: '5 min', suffix: 'W/kg', decimals: 2 },
        { key: 'power_wkg1200', label: '20 min', suffix: 'W/kg', decimals: 2 }
    ]);

    // Phenotype
    html += renderSection('Phenotype', [
        { key: 'phenotype_value', label: 'Type' },
        { key: 'phenotype_bias', label: 'Bias', decimals: 2 },
        { key: 'phenotype_scores_sprinter', label: 'Sprinter', decimals: 1 },
        { key: 'phenotype_scores_puncheur', label: 'Puncheur', decimals: 1 },
        { key: 'phenotype_scores_pursuiter', label: 'Pursuiter', decimals: 1 },
        { key: 'phenotype_scores_tt', label: 'TT', decimals: 1 },
        { key: 'phenotype_scores_climber', label: 'Climber', decimals: 1 }
    ]);

    // Profile Handicaps (convert to percentage for display)
    const handicapFields = [];
    if (data.handicaps_profile_flat) handicapFields.push({ key: 'handicaps_profile_flat', label: 'Flat', value: (data.handicaps_profile_flat * 100).toFixed(1) + '%' });
    if (data.handicaps_profile_rolling) handicapFields.push({ key: 'handicaps_profile_rolling', label: 'Rolling', value: (data.handicaps_profile_rolling * 100).toFixed(1) + '%' });
    if (data.handicaps_profile_hilly) handicapFields.push({ key: 'handicaps_profile_hilly', label: 'Hilly', value: (data.handicaps_profile_hilly * 100).toFixed(1) + '%' });
    if (data.handicaps_profile_mountainous) handicapFields.push({ key: 'handicaps_profile_mountainous', label: 'Mountainous', value: (data.handicaps_profile_mountainous * 100).toFixed(1) + '%' });

    if (handicapFields.length > 0) {
        let handicapHtml = '<div class="details-section"><div class="details-section-title">Profile Suitability</div><div class="details-grid">';
        for (const field of handicapFields) {
            handicapHtml += `<div class="details-item"><span class="details-label">${field.label}:</span><span class="details-value">${field.value}</span></div>`;
        }
        handicapHtml += '</div></div>';
        html += handicapHtml;
    }

    // Race Statistics
    html += renderSection('Race Statistics', [
        { key: 'race_finishes', label: 'Finishes' },
        { key: 'race_wins', label: 'Wins' },
        { key: 'race_podiums', label: 'Podiums' },
        { key: 'race_dnfs', label: 'DNFs' }
    ]);

    // Race Rankings - Current
    html += renderSection('Current Race Ranking', [
        { key: 'race_current_rating', label: 'Rating', decimals: 1 },
        { key: 'race_current_mixed_category', label: 'Mixed Category' },
        { key: 'race_current_mixed_number', label: 'Mixed Rank' },
        { key: 'race_current_womens_category', label: 'Womens Category' },
        { key: 'race_current_womens_number', label: 'Womens Rank' }
    ]);

    // Race Rankings - Max 30 days
    html += renderSection('Max 30-Day Ranking', [
        { key: 'race_max30_rating', label: 'Rating', decimals: 1 },
        { key: 'race_max30_mixed_category', label: 'Mixed Category' },
        { key: 'race_max30_mixed_number', label: 'Mixed Rank' },
        { key: 'race_max30_womens_category', label: 'Womens Category' },
        { key: 'race_max30_womens_number', label: 'Womens Rank' }
    ]);

    // Race Rankings - Max 90 days
    html += renderSection('Max 90-Day Ranking', [
        { key: 'race_max90_rating', label: 'Rating', decimals: 1 },
        { key: 'race_max90_mixed_category', label: 'Mixed Category' },
        { key: 'race_max90_mixed_number', label: 'Mixed Rank' },
        { key: 'race_max90_womens_category', label: 'Womens Category' },
        { key: 'race_max90_womens_numbe', label: 'Womens Rank' }
    ]);

    // Race Rankings - Last
    html += renderSection('Last Race Ranking', [
        { key: 'race_last_rating', label: 'Rating', decimals: 1 },
        { key: 'race_last_mixed_category', label: 'Mixed Category' },
        { key: 'race_last_mixed_number', label: 'Mixed Rank' },
        { key: 'race_last_womens_category', label: 'Womens Category' },
        { key: 'race_last_womens_number', label: 'Womens Rank' }
    ]);

    // Metadata
    let metadataHtml = '';
    if (data.modified) {
        metadataHtml += `<div class="details-item"><span class="details-label">Source Updated:</span><span class="details-value">${data.modified}</span></div>`;
    }
    if (data.importedAt) {
        const importDate = new Date(data.importedAt);
        metadataHtml += `<div class="details-item"><span class="details-label">Imported:</span><span class="details-value">${importDate.toLocaleDateString()} ${importDate.toLocaleTimeString()}</span></div>`;
    }
    if (metadataHtml) {
        html += `<div class="details-section"><div class="details-section-title">Metadata</div><div class="details-grid">${metadataHtml}</div></div>`;
    }

    html += '</div>';
    return html;
}
