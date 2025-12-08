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

// Available power duration columns
const POWER_COLUMNS = [
    { key: 'power5s', seconds: 5, label: '5s' },
    { key: 'power15s', seconds: 15, label: '15s' },
    { key: 'power60s', seconds: 60, label: '1m' },
    { key: 'power300s', seconds: 300, label: '5m' },
    { key: 'power1200s', seconds: 1200, label: '20m' }
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
    refreshInterval: 2,            // Refresh interval in seconds
    maxGap: 30,                    // Max gap in seconds to show riders
    filterSameCategory: false,     // Only show riders in same event category
    filterMarked: false            // Only show marked/followed riders
});

// Max HR storage key (global, shared across windows via leading /)
const MAX_HR_STORAGE_KEY = '/hr-zone-monitor-max-hr-data';
// Max power storage key (tracks observed max 30s and 1min power per athlete)
const MAX_POWER_STORAGE_KEY = '/hr-zone-monitor-max-power-data';

// HR Zone definitions (% of max HR)
const HR_ZONES = [
    { min: 0,   max: 60,  color: '#888888', name: 'Zone 1 (Recovery)' },
    { min: 60,  max: 70,  color: '#2196F3', name: 'Zone 2 (Endurance)' },
    { min: 70,  max: 80,  color: '#4CAF50', name: 'Zone 3 (Tempo)' },
    { min: 80,  max: 90,  color: '#FFEB3B', name: 'Zone 4 (Threshold)' },
    { min: 90,  max: 999, color: '#F44336', name: 'Zone 5 (VO2 Max)' }
];

// Power Zone definitions (% of max observed power) - matches HR zones
const POWER_ZONES = [
    { min: 0,   max: 60,  color: '#888888', name: 'Zone 1 (Recovery)' },
    { min: 60,  max: 70,  color: '#2196F3', name: 'Zone 2 (Endurance)' },
    { min: 70,  max: 80,  color: '#4CAF50', name: 'Zone 3 (Tempo)' },
    { min: 80,  max: 90,  color: '#FFEB3B', name: 'Zone 4 (Threshold)' },
    { min: 90,  max: 999, color: '#F44336', name: 'Zone 5 (VO2 Max)' }
];

let nearbyData;  // Flat array of nearby athletes
let storedMaxHRData = {};  // Persisted: { athleteId: maxHR, name_athleteId: "Name" }
let storedMaxPowerData = {};  // Persisted: { athleteId_5s: maxPower, athleteId_15s: maxPower, ... }
let sessionMaxHRData = {};  // Session-only: { athleteId: maxHR }
let sessionMaxPowerData = {};  // Session-only: { athleteId_5s: maxPower, ... }
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
    return storedMaxHRData[athleteId] || 0;
}

function getEffectiveMaxPower(athleteId, seconds) {
    const mode = common.settingsStore.get('maxValueMode') || 'stored';
    const key = `${athleteId}_${seconds}s`;
    if (mode === 'session') {
        return sessionMaxPowerData[key] || 0;
    }
    return storedMaxPowerData[key] || 0;
}

export async function main() {
    common.initInteractionListeners();
    loadStoredMaxHRData();
    loadStoredMaxPowerData();

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
        renderRiders();
    });

    // Listen for max HR data changes from settings window
    common.settingsStore.addEventListener('set', ev => {
        if (ev.data.key === MAX_HR_STORAGE_KEY) {
            storedMaxHRData = ev.data.value || {};
            renderRiders();
        }
        if (ev.data.key === MAX_POWER_STORAGE_KEY) {
            storedMaxPowerData = ev.data.value || {};
            renderRiders();
        }
    });
}

function loadStoredMaxHRData() {
    storedMaxHRData = common.settingsStore.get(MAX_HR_STORAGE_KEY) || {};
}

function saveStoredMaxHRData() {
    common.settingsStore.set(MAX_HR_STORAGE_KEY, storedMaxHRData);
}

function loadStoredMaxPowerData() {
    storedMaxPowerData = common.settingsStore.get(MAX_POWER_STORAGE_KEY) || {};
}

function saveStoredMaxPowerData() {
    common.settingsStore.set(MAX_POWER_STORAGE_KEY, storedMaxPowerData);
}

function updateMaxPower(athleteId, powerValues, name, team) {
    // powerValues is an object like { 5: watts, 15: watts, 60: watts, ... }
    const mode = common.settingsStore.get('maxValueMode') || 'stored';
    let storedUpdated = false;

    for (const [seconds, power] of Object.entries(powerValues)) {
        if (power > 0) {
            const key = `${athleteId}_${seconds}s`;
            const roundedPower = Math.round(power);

            // Always update session max
            if (!sessionMaxPowerData[key] || roundedPower > sessionMaxPowerData[key]) {
                sessionMaxPowerData[key] = roundedPower;
            }

            // Update stored max if in stored mode
            if (mode === 'stored') {
                if (!storedMaxPowerData[key] || roundedPower > storedMaxPowerData[key]) {
                    storedMaxPowerData[key] = roundedPower;
                    storedUpdated = true;
                }
            }
        }
    }

    // Store name/team in HR data structure if we have power data and stored mode
    if (storedUpdated && mode === 'stored') {
        if (name && !storedMaxHRData[`name_${athleteId}`]) {
            storedMaxHRData[`name_${athleteId}`] = name;
        }
        if (team && !storedMaxHRData[`team_${athleteId}`]) {
            storedMaxHRData[`team_${athleteId}`] = team;
            saveStoredMaxHRData();
        }
        saveStoredMaxPowerData();
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

    // Update stored max if in stored mode
    if (mode === 'stored') {
        if (!storedMaxHRData[athleteId] || roundedHR > storedMaxHRData[athleteId]) {
            storedMaxHRData[athleteId] = roundedHR;
            if (name) {
                storedMaxHRData[`name_${athleteId}`] = name;
            }
            if (team) {
                storedMaxHRData[`team_${athleteId}`] = team;
            }
            saveStoredMaxHRData();
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
    const maxGap = settings.maxGap || 30;  // Default 30 seconds
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
            storedMaxHRData[dialogAthleteId] = maxHR;
            if (dialogAthleteName) {
                storedMaxHRData[`name_${dialogAthleteId}`] = dialogAthleteName;
            }
            saveStoredMaxHRData();
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

function renderRiders() {
    if (!nearbyData || !nearbyData.length) return;

    const settings = common.settingsStore.get();
    const tbody = document.getElementById('rider-table');
    tbody.innerHTML = '';

    const maxRiders = settings.maxRiders || 20;

    // Find the watching athlete for filter comparisons
    const watchingAthlete = nearbyData.find(a => a.watching);

    // Apply filters and limit riders
    let riders = applyFilters(nearbyData, settings, watchingAthlete);
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
            showMaxHRDialog(athleteId, name, storedMaxHRData[athleteId]);
        });

        // Name cell
        const nameCell = document.createElement('td');
        nameCell.className = 'name-cell';
        nameCell.textContent = truncateName(name, 15);
        nameCell.title = name;

        // Team cell (if enabled)
        let teamCell = null;
        if (settings.showTeamColumn) {
            const storedTeam = storedMaxHRData[`team_${athleteId}`];
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

    // Resize window to fit content (850x600 is good for Known Athletes table)
    window.resizeTo(850, 600);

    loadStoredMaxHRData();
    loadStoredMaxPowerData();
    renderAthleteMaxList();
    setupBackgroundOptionToggle();
    setupAthleteSearch();
    setupTabNavigation();
    setupEventViewer();
    setupZwiftPowerTab();

    // Add rider button handler
    const addBtn = document.getElementById('add-rider-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const idInput = document.getElementById('new-rider-id');
            const maxhrInput = document.getElementById('new-rider-maxhr');
            const nameInput = document.getElementById('new-rider-name');

            const athleteId = parseInt(idInput.value);
            const maxHR = parseInt(maxhrInput.value);

            if (athleteId && maxHR && maxHR >= 100 && maxHR <= 250) {
                storedMaxHRData[athleteId] = Math.round(maxHR);
                if (nameInput && nameInput.value) {
                    storedMaxHRData[`name_${athleteId}`] = nameInput.value;
                }
                saveStoredMaxHRData();
                renderAthleteMaxList();
                idInput.value = '';
                maxhrInput.value = '';
                if (nameInput) nameInput.value = '';
            }
        });
    }

    // Listen for storage changes
    common.settingsStore.addEventListener('set', ev => {
        if (ev.data.key === MAX_HR_STORAGE_KEY) {
            storedMaxHRData = ev.data.value || {};
            renderAthleteMaxListWithCurrentSearch();
        }
        if (ev.data.key === MAX_POWER_STORAGE_KEY) {
            storedMaxPowerData = ev.data.value || {};
            renderAthleteMaxListWithCurrentSearch();
        }
    });
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
    // Load cached events on startup
    await loadCachedEvents();

    const loadBtn = document.getElementById('load-event-btn');
    const eventInput = document.getElementById('event-input');
    const cachedSelect = document.getElementById('cached-events');
    const subgroupSelect = document.getElementById('subgroup-select');
    const entrantSearch = document.getElementById('entrant-search');

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

    let filteredEntrants = currentEntrants;

    if (searchFilter) {
        const filterLower = searchFilter.toLowerCase();
        filteredEntrants = currentEntrants.filter(entrant => {
            const name = getEntrantName(entrant).toLowerCase();
            const team = (entrant.team || '').toLowerCase();
            const idStr = String(entrant.id || entrant.athleteId || '');
            return name.includes(filterLower) || team.includes(filterLower) || idStr.includes(filterLower);
        });
    }

    // Add header row (team column always visible in event viewer)
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
    `;
    container.appendChild(headerRow);

    if (filteredEntrants.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'no-riders';
        emptyMsg.textContent = searchFilter ? 'No entrants match your search.' : 'No entrants found';
        container.appendChild(emptyMsg);
        return;
    }

    // Sort by name
    filteredEntrants.sort((a, b) => {
        return getEntrantName(a).localeCompare(getEntrantName(b));
    });

    for (const entrant of filteredEntrants) {
        const athleteId = entrant.id || entrant.athleteId;
        const name = getEntrantName(entrant);
        const team = entrant.team || '';

        // Get stored values for this athlete
        const maxHR = storedMaxHRData[athleteId] || '';
        const storedName = storedMaxHRData[`name_${athleteId}`];
        const storedTeam = storedMaxHRData[`team_${athleteId}`];

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
        const displayTeam = storedTeam || team;
        if (displayTeam) metaParts.push(displayTeam);
        metaParts.push(`ID: ${athleteId}`);
        metaSpan.textContent = metaParts.join(' · ');
        infoDiv.appendChild(metaSpan);

        // Team input (always visible in event viewer)
        const teamInput = document.createElement('input');
        teamInput.type = 'text';
        teamInput.className = 'team-input';
        teamInput.value = storedTeam || team;
        teamInput.placeholder = 'Team';
        teamInput.title = 'Team name';
        teamInput.addEventListener('change', (ev) => {
            const newTeam = ev.target.value.trim();
            if (newTeam) {
                storedMaxHRData[`team_${athleteId}`] = newTeam;
            } else {
                delete storedMaxHRData[`team_${athleteId}`];
            }
            // Also store name if not already stored
            if (!storedName && name) {
                storedMaxHRData[`name_${athleteId}`] = name;
            }
            saveStoredMaxHRData();
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
            if (newMaxHR >= 100 && newMaxHR <= 250) {
                storedMaxHRData[athleteId] = Math.round(newMaxHR);
                // Also store name and team if not already stored
                if (!storedName && name) {
                    storedMaxHRData[`name_${athleteId}`] = name;
                }
                if (!storedTeam && team) {
                    storedMaxHRData[`team_${athleteId}`] = team;
                }
                saveStoredMaxHRData();
            } else if (ev.target.value === '') {
                delete storedMaxHRData[athleteId];
                saveStoredMaxHRData();
            }
        });

        // Power inputs container
        const powerInputs = document.createElement('div');
        powerInputs.className = 'power-inputs';

        for (const col of POWER_COLUMNS) {
            const powerKey = `${athleteId}_${col.seconds}s`;
            const powerValue = storedMaxPowerData[powerKey] || '';

            const powerInput = document.createElement('input');
            powerInput.type = 'number';
            powerInput.className = 'max-value-input power-input';
            powerInput.value = powerValue;
            powerInput.min = 0;
            powerInput.max = 2500;
            powerInput.placeholder = col.label;
            powerInput.title = `Max ${col.label} power`;
            powerInput.addEventListener('change', (ev) => {
                const newPower = parseInt(ev.target.value);
                if (newPower > 0) {
                    storedMaxPowerData[powerKey] = Math.round(newPower);
                    // Also store name and team if not already stored
                    if (!storedName && name) {
                        storedMaxHRData[`name_${athleteId}`] = name;
                    }
                    if (!storedTeam && team) {
                        storedMaxHRData[`team_${athleteId}`] = team;
                        saveStoredMaxHRData();
                    }
                    saveStoredMaxPowerData();
                } else if (ev.target.value === '') {
                    delete storedMaxPowerData[powerKey];
                    saveStoredMaxPowerData();
                }
            });
            powerInputs.appendChild(powerInput);
        }

        // Update button (fetch from ZwiftPower)
        const updateBtn = document.createElement('button');
        updateBtn.type = 'button';
        updateBtn.className = 'update-btn';
        updateBtn.innerHTML = '<ms>sync</ms>';
        updateBtn.title = 'Update from ZwiftPower';
        updateBtn.addEventListener('click', async () => {
            // Get saved credentials
            const credentials = common.settingsStore.get(ZP_CREDENTIALS_KEY);
            if (!credentials?.username || !credentials?.password) {
                alert('Please save your ZwiftPower credentials in the ZwiftPower tab first.');
                return;
            }

            // Check if server is running
            const serverRunning = await checkZpServer();
            if (!serverRunning) {
                alert('ZwiftPower fetch server is not running.\n\nStart it with: node zp-fetch.mjs --server');
                return;
            }

            // Show loading state
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<span class="spinner-inline"></span>';

            try {
                const profile = await fetchFromServer(athleteId, credentials);
                displayZpProfile(profile);
                // Re-render the entrants list to show updated values
                renderEntrants(document.getElementById('entrant-search')?.value || '');
            } catch (error) {
                alert(`Failed to update: ${error.message}`);
            } finally {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<ms>sync</ms>';
            }
        });

        row.appendChild(infoDiv);
        row.appendChild(teamInput);
        row.appendChild(hrInput);
        row.appendChild(powerInputs);
        row.appendChild(updateBtn);
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
// ZwiftPower File Import
// ============================================================================

// Global state for ZwiftPower import
let currentZpProfile = null;
let selectedZpFile = null;

// Storage key for ZwiftPower credentials
const ZP_CREDENTIALS_KEY = '/hr-zone-monitor-zp-credentials';
const ZP_SERVER_URL = 'http://127.0.0.1:5050';

/**
 * Setup ZwiftPower credentials handlers
 */
function setupZpCredentials() {
    const usernameInput = document.getElementById('zp-username');
    const passwordInput = document.getElementById('zp-password');
    const saveBtn = document.getElementById('zp-save-credentials');
    const statusSpan = document.getElementById('zp-credentials-status');

    if (!usernameInput || !passwordInput || !saveBtn) return;

    // Load saved credentials
    const saved = common.settingsStore.get(ZP_CREDENTIALS_KEY);
    if (saved) {
        usernameInput.value = saved.username || '';
        passwordInput.value = saved.password || '';
    }

    // Save button handler
    saveBtn.addEventListener('click', () => {
        const credentials = {
            username: usernameInput.value.trim(),
            password: passwordInput.value
        };

        common.settingsStore.set(ZP_CREDENTIALS_KEY, credentials);

        if (statusSpan) {
            statusSpan.textContent = 'Saved!';
            setTimeout(() => {
                statusSpan.textContent = '';
            }, 2000);
        }
    });
}

/**
 * Check if the ZP fetch server is running
 */
async function checkZpServer() {
    try {
        const response = await fetch(`${ZP_SERVER_URL}/health`, {
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Update server status indicator
 */
async function updateServerStatus() {
    const statusEl = document.getElementById('zp-server-status');
    if (!statusEl) return;

    const isRunning = await checkZpServer();
    statusEl.textContent = isRunning ? '● Server running' : '○ Server not running';
    statusEl.className = isRunning ? 'zp-server-status online' : 'zp-server-status offline';
}

/**
 * Update fetch status display
 * @param {string} state - 'idle' | 'fetching' | 'success' | 'error'
 * @param {string} message - Optional message to display
 */
function setFetchStatus(state, message = '') {
    const statusEl = document.getElementById('zp-fetch-status');
    if (!statusEl) return;

    statusEl.className = 'zp-fetch-status ' + state;

    switch (state) {
        case 'idle':
            statusEl.textContent = '';
            break;
        case 'fetching':
            statusEl.innerHTML = '<span class="spinner-inline"></span> Fetching data...';
            break;
        case 'success':
            statusEl.textContent = '✓ ' + message;
            break;
        case 'error':
            statusEl.textContent = '✗ ' + message;
            break;
    }
}

/**
 * Setup ZwiftPower fetch handler
 */
function setupZpFetch() {
    const fetchBtn = document.getElementById('zp-fetch-btn');
    const athleteIdInput = document.getElementById('zp-fetch-athlete-id');

    if (!fetchBtn || !athleteIdInput) return;

    // Check server status on load and periodically
    updateServerStatus();
    setInterval(updateServerStatus, 10000);

    fetchBtn.addEventListener('click', async () => {
        const athleteId = parseInt(athleteIdInput.value);
        if (!athleteId || athleteId < 1) {
            setFetchStatus('error', 'Please enter a valid Athlete ID');
            return;
        }

        // Get saved credentials
        const credentials = common.settingsStore.get(ZP_CREDENTIALS_KEY);
        if (!credentials?.username || !credentials?.password) {
            setFetchStatus('error', 'Please save your credentials first');
            return;
        }

        // Show loading state
        fetchBtn.disabled = true;
        setFetchStatus('fetching');
        document.getElementById('zp-profile-section').hidden = true;

        try {
            const profile = await fetchFromServer(athleteId, credentials);
            displayZpProfile(profile);
            const name = profile.data?.[0]?.name || `Athlete ${athleteId}`;
            setFetchStatus('success', `Imported: ${name}`);
        } catch (error) {
            setFetchStatus('error', error.message);
        } finally {
            fetchBtn.disabled = false;
        }
    });
}

/**
 * Fetch profile from local server
 */
async function fetchFromServer(athleteId, credentials) {
    const params = new URLSearchParams({
        athleteId: athleteId.toString(),
        username: credentials.username,
        password: credentials.password
    });

    const response = await fetch(`${ZP_SERVER_URL}/fetch?${params}`);

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Failed to fetch profile');
    }

    return {
        athleteId: data.athleteId,
        data: data.data || []
    };
}

/**
 * Setup ZwiftPower tab UI handlers
 */
function setupZwiftPowerTab() {
    const fileInput = document.getElementById('zp-file-input');
    const fileNameSpan = document.getElementById('zp-file-name');
    const importFileBtn = document.getElementById('zp-import-file-btn');
    const athleteIdInput = document.getElementById('zp-athlete-id');

    // Setup credentials handlers
    setupZpCredentials();

    // Setup fetch handler
    setupZpFetch();

    // File selection handler
    if (fileInput) {
        fileInput.addEventListener('change', (ev) => {
            const file = ev.target.files[0];
            if (file) {
                selectedZpFile = file;
                if (fileNameSpan) {
                    fileNameSpan.textContent = file.name;
                }
                // Try to extract athlete ID from filename (e.g., "87402_all.json")
                const match = file.name.match(/^(\d+)_all\.json$/);
                if (match && athleteIdInput) {
                    athleteIdInput.value = match[1];
                }
            } else {
                selectedZpFile = null;
                if (fileNameSpan) {
                    fileNameSpan.textContent = '';
                }
            }
        });
    }

    // Import from file button handler
    if (importFileBtn) {
        importFileBtn.addEventListener('click', async () => {
            const athleteId = parseInt(athleteIdInput?.value);
            if (!athleteId || athleteId < 1) {
                showZpError('Please enter a valid Athlete ID');
                return;
            }

            if (!selectedZpFile) {
                showZpError('Please select a JSON file first');
                return;
            }

            await processZpFile(selectedZpFile, athleteId);
        });
    }
}

/**
 * Process uploaded ZwiftPower JSON file
 */
async function processZpFile(file, athleteId) {
    showZpLoading(true);
    hideZpError();
    document.getElementById('zp-profile-section').hidden = true;

    try {
        const text = await file.text();
        let profileData;

        try {
            profileData = JSON.parse(text);
        } catch (parseError) {
            throw new Error('Invalid JSON file. Please ensure you downloaded the correct file from ZwiftPower.');
        }

        // Validate the data structure
        if (!profileData.data || !Array.isArray(profileData.data)) {
            throw new Error('Invalid ZwiftPower profile format. Expected { "data": [...] } structure.');
        }

        if (profileData.data.length === 0) {
            throw new Error('No race data found in the profile file.');
        }

        currentZpProfile = {
            athleteId,
            ...profileData
        };

        displayZpProfile(currentZpProfile);

    } catch (error) {
        showZpError(error.message);
        currentZpProfile = null;
    } finally {
        showZpLoading(false);
    }
}

function displayZpProfile(profile) {
    const container = document.getElementById('zp-profile-display');
    const section = document.getElementById('zp-profile-section');

    if (!container || !profile) return;

    const data = profile.data || [];
    if (data.length === 0) {
        container.innerHTML = '<div class="zp-profile-row"><span class="zp-value">No race data found for this athlete.</span></div>';
        section.hidden = false;
        return;
    }

    const firstRace = data[0];
    const athleteId = profile.athleteId;

    // Filter to last 60 days
    const now = Date.now() / 1000;  // Current time in seconds
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60);  // 60 days in seconds
    const recentRaces = data.filter(race => (race.event_date || 0) >= sixtyDaysAgo);

    // Find best power values from RECENT races only (last 60 days)
    const bestValues = {
        name: firstRace.name || `Athlete ${athleteId}`,
        team: firstRace.tname || '',
        ftp: parseInt(firstRace.ftp) || 0,
        weight: parseFloat(firstRace.weight?.[0]) || 0,
        category: firstRace.category || '',
        country: firstRace.flag || '',
        w5: 0,
        w15: 0,
        w60: 0,
        w300: 0,
        w1200: 0,
        hrmax: 0,
        raceCount: data.length,
        recentRaceCount: recentRaces.length
    };

    // Find maximum power values from recent races only
    for (const race of recentRaces) {
        const w5 = parseInt(race.w5?.[0]) || 0;
        const w15 = parseInt(race.w15?.[0]) || 0;
        const w60 = parseInt(race.w60?.[0]) || 0;
        const w300 = parseInt(race.w300?.[0]) || 0;
        const w1200 = parseInt(race.w1200?.[0]) || 0;

        if (w5 > bestValues.w5) bestValues.w5 = w5;
        if (w15 > bestValues.w15) bestValues.w15 = w15;
        if (w60 > bestValues.w60) bestValues.w60 = w60;
        if (w300 > bestValues.w300) bestValues.w300 = w300;
        if (w1200 > bestValues.w1200) bestValues.w1200 = w1200;
    }

    // Calculate average of top 3 max_hr values from recent races
    const maxHrValues = recentRaces
        .map(race => parseInt(race.max_hr?.[0]) || 0)
        .filter(hr => hr > 0)
        .sort((a, b) => b - a);  // Sort descending

    const top3Hr = maxHrValues.slice(0, 3);
    bestValues.hrmax = top3Hr.length > 0
        ? Math.round(top3Hr.reduce((sum, hr) => sum + hr, 0) / top3Hr.length)
        : 0;

    // Build profile display HTML
    const fields = [
        { label: 'Athlete ID', value: athleteId },
        { label: 'Name', value: bestValues.name },
        { label: 'Team', value: bestValues.team || 'N/A' },
        { label: 'Country', value: bestValues.country ? bestValues.country.toUpperCase() : 'N/A' },
        { label: 'Category', value: bestValues.category || 'N/A' },
        { label: 'FTP', value: bestValues.ftp ? `${bestValues.ftp}W` : 'N/A' },
        { label: 'Weight', value: bestValues.weight ? `${bestValues.weight} kg` : 'N/A' },
        { label: 'Avg Max HR (top 3)', value: bestValues.hrmax ? `${bestValues.hrmax} bpm` : 'N/A' },
        { label: 'Best 5s (60d)', value: bestValues.w5 ? `${bestValues.w5}W` : 'N/A' },
        { label: 'Best 15s (60d)', value: bestValues.w15 ? `${bestValues.w15}W` : 'N/A' },
        { label: 'Best 1min (60d)', value: bestValues.w60 ? `${bestValues.w60}W` : 'N/A' },
        { label: 'Best 5min (60d)', value: bestValues.w300 ? `${bestValues.w300}W` : 'N/A' },
        { label: 'Best 20min (60d)', value: bestValues.w1200 ? `${bestValues.w1200}W` : 'N/A' },
        { label: 'Races (60d / total)', value: `${bestValues.recentRaceCount} / ${bestValues.raceCount}` }
    ];

    container.innerHTML = fields.map(f => `
        <div class="zp-profile-row">
            <span class="zp-label">${f.label}:</span>
            <span class="zp-value">${f.value}</span>
        </div>
    `).join('');

    // Auto-import data to stored data
    importZpData(athleteId, bestValues);

    // Show raw data in collapsible section (limit to first 3 races for display)
    const sampleData = data.slice(0, 3);
    container.innerHTML += `
        <details class="zp-raw-data">
            <summary>View Raw Data (first ${sampleData.length} of ${data.length} races)</summary>
            <pre>${JSON.stringify(sampleData, null, 2)}</pre>
        </details>
    `;

    section.hidden = false;
}

function importZpData(athleteId, best) {
    if (!athleteId || !best) return;

    let imported = [];

    // Import name
    if (best.name) {
        storedMaxHRData[`name_${athleteId}`] = best.name;
        imported.push('name');
    }

    // Import team
    if (best.team) {
        storedMaxHRData[`team_${athleteId}`] = best.team;
        imported.push('team');
    }

    // Import max HR (average of top 3)
    if (best.hrmax && best.hrmax >= 100 && best.hrmax <= 250) {
        storedMaxHRData[athleteId] = best.hrmax;
        imported.push('max HR');
    }

    // Import power data (from last 60 days)
    if (best.w5 > 0) {
        storedMaxPowerData[`${athleteId}_5s`] = best.w5;
        imported.push('5s power');
    }
    if (best.w15 > 0) {
        storedMaxPowerData[`${athleteId}_15s`] = best.w15;
        imported.push('15s power');
    }
    if (best.w60 > 0) {
        storedMaxPowerData[`${athleteId}_60s`] = best.w60;
        imported.push('1min power');
    }
    if (best.w300 > 0) {
        storedMaxPowerData[`${athleteId}_300s`] = best.w300;
        imported.push('5min power');
    }
    if (best.w1200 > 0) {
        storedMaxPowerData[`${athleteId}_1200s`] = best.w1200;
        imported.push('20min power');
    }

    // Save to storage
    saveStoredMaxHRData();
    saveStoredMaxPowerData();

    // Show success message
    const displayName = best.name || `Athlete ${athleteId}`;
    showZpError(`Saved ${imported.length} values for ${displayName}: ${imported.join(', ')}`, 'success');

    // Re-render athlete list if on settings tab
    renderAthleteMaxListWithCurrentSearch();
}

function showZpLoading(show) {
    const el = document.getElementById('zp-lookup-loading');
    if (el) el.hidden = !show;
}

function showZpError(message, type = 'error') {
    const errorEl = document.getElementById('zp-lookup-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.className = type === 'success' ? 'zp-success-message' : '';
        errorEl.hidden = false;
    }
}

function hideZpError() {
    const el = document.getElementById('zp-lookup-error');
    if (el) el.hidden = true;
}

function renderAthleteMaxListWithCurrentSearch() {
    const searchInput = document.getElementById('athlete-search');
    const currentFilter = searchInput ? searchInput.value : '';
    renderAthleteMaxList(currentFilter);
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

    // Collect all athlete IDs from both HR and power data
    const hrAthleteIds = Object.keys(storedMaxHRData)
        .filter(key => !key.startsWith('name_') && !key.startsWith('team_'))
        .map(Number)
        .filter(id => !isNaN(id));

    const powerAthleteIds = Object.keys(storedMaxPowerData)
        .map(key => {
            const match = key.match(/^(\d+)_\d+s$/);
            return match ? parseInt(match[1]) : null;
        })
        .filter(id => id !== null);

    let allAthleteIds = [...new Set([...hrAthleteIds, ...powerAthleteIds])];

    // Apply search filter
    if (searchFilter) {
        const filterLower = searchFilter.toLowerCase();
        allAthleteIds = allAthleteIds.filter(athleteId => {
            const name = storedMaxHRData[`name_${athleteId}`] || '';
            const team = storedMaxHRData[`team_${athleteId}`] || '';
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
        <span class="header-label delete-header"></span>
    `;
    container.appendChild(headerRow);

    if (allAthleteIds.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'no-riders';
        emptyMsg.textContent = searchFilter
            ? 'No athletes match your search.'
            : 'No athlete data yet. Max values are automatically tracked during rides, or add manually below.';
        container.appendChild(emptyMsg);
        return;
    }

    // Group power data by athlete
    const athletePowerData = {};
    for (const [key, value] of Object.entries(storedMaxPowerData)) {
        const match = key.match(/^(\d+)_(\d+)s$/);
        if (match) {
            const athleteId = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            if (!athletePowerData[athleteId]) {
                athletePowerData[athleteId] = {};
            }
            athletePowerData[athleteId][seconds] = value;
        }
    }

    for (const athleteId of allAthleteIds) {
        const name = storedMaxHRData[`name_${athleteId}`] || `Athlete ${athleteId}`;
        const team = storedMaxHRData[`team_${athleteId}`] || '';
        const maxHR = storedMaxHRData[athleteId] || '';
        const powers = athletePowerData[athleteId] || {};

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
            if (newTeam) {
                storedMaxHRData[`team_${athleteId}`] = newTeam;
            } else {
                delete storedMaxHRData[`team_${athleteId}`];
            }
            saveStoredMaxHRData();
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
            if (newMaxHR >= 100 && newMaxHR <= 250) {
                storedMaxHRData[athleteId] = Math.round(newMaxHR);
                saveStoredMaxHRData();
            } else if (ev.target.value === '') {
                delete storedMaxHRData[athleteId];
                saveStoredMaxHRData();
            }
        });

        // Power inputs container
        const powerInputs = document.createElement('div');
        powerInputs.className = 'power-inputs';

        for (const col of POWER_COLUMNS) {
            const powerValue = powers[col.seconds] || '';
            const powerInput = document.createElement('input');
            powerInput.type = 'number';
            powerInput.className = 'max-value-input power-input';
            powerInput.value = powerValue;
            powerInput.min = 0;
            powerInput.max = 2500;
            powerInput.placeholder = col.label;
            powerInput.title = `Max ${col.label} power`;
            powerInput.addEventListener('change', (ev) => {
                const key = `${athleteId}_${col.seconds}s`;
                const newPower = parseInt(ev.target.value);
                if (newPower > 0) {
                    storedMaxPowerData[key] = Math.round(newPower);
                    saveStoredMaxPowerData();
                } else {
                    delete storedMaxPowerData[key];
                    saveStoredMaxPowerData();
                }
            });
            powerInputs.appendChild(powerInput);
        }

        // Update button (fetch from ZwiftPower)
        const updateBtn = document.createElement('button');
        updateBtn.type = 'button';
        updateBtn.className = 'update-btn';
        updateBtn.innerHTML = '<ms>sync</ms>';
        updateBtn.title = 'Update from ZwiftPower';
        updateBtn.addEventListener('click', async () => {
            // Get saved credentials
            const credentials = common.settingsStore.get(ZP_CREDENTIALS_KEY);
            if (!credentials?.username || !credentials?.password) {
                alert('Please save your ZwiftPower credentials in the ZwiftPower tab first.');
                return;
            }

            // Check if server is running
            const serverRunning = await checkZpServer();
            if (!serverRunning) {
                alert('ZwiftPower fetch server is not running.\n\nStart it with: node zp-fetch.mjs --server');
                return;
            }

            // Show loading state
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<span class="spinner-inline"></span>';

            try {
                const profile = await fetchFromServer(athleteId, credentials);
                displayZpProfile(profile);
                // Re-render the list to show updated values
                renderAthleteMaxListWithCurrentSearch();
            } catch (error) {
                alert(`Failed to update: ${error.message}`);
            } finally {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<ms>sync</ms>';
            }
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<ms>delete</ms>';
        deleteBtn.title = 'Delete all data for this athlete';
        deleteBtn.addEventListener('click', () => {
            // Delete HR data
            delete storedMaxHRData[athleteId];
            delete storedMaxHRData[`name_${athleteId}`];
            delete storedMaxHRData[`team_${athleteId}`];
            saveStoredMaxHRData();

            // Delete all power data for this athlete
            for (const col of POWER_COLUMNS) {
                delete storedMaxPowerData[`${athleteId}_${col.seconds}s`];
            }
            saveStoredMaxPowerData();

            renderAthleteMaxList();
        });

        row.appendChild(infoDiv);
        row.appendChild(teamInput);
        row.appendChild(hrInput);
        row.appendChild(powerInputs);
        row.appendChild(updateBtn);
        row.appendChild(deleteBtn);
        container.appendChild(row);
    }
}
