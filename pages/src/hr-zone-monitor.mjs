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
    // Filter settings (checkboxes - combinable with OR logic)
    filterShowAll: true,           // When true, ignores other filters
    filterOnlyWithHR: false,       // Only riders broadcasting HR
    filterInGroup: false,          // Same group as watched athlete
    filterMarkedFollowing: false,  // Marked or following in Sauce4Zwift
    filterSameEvent: false,        // Same event subgroup
    filterByTeam: false,           // Enable team filter
    filterTeamName: ''             // Team name to filter (when filterByTeam=true)
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

    // Migrate old showOnlyWithHR setting to new filter system
    migrateOldSettings();

    doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
    applyBackground();

    // Setup dialog event listeners
    setupDialog();

    // Setup filter bar checkboxes
    setupMainWindowFilters();

    // Subscribe to nearby data (same as nearby athletes window)
    common.subscribe('nearby', data => {
        if (!data || !data.length) return;
        nearbyData = data;
        renderRiders();
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
        syncFilterCheckboxes();
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

function migrateOldSettings() {
    // Migrate old showOnlyWithHR setting to new filter system
    const oldSetting = common.settingsStore.get('showOnlyWithHR');
    if (oldSetting !== undefined) {
        // If old setting was true, enable the new HR filter
        if (oldSetting === true) {
            common.settingsStore.set('filterOnlyWithHR', true);
            common.settingsStore.set('filterShowAll', false);
        }
        // Remove the old setting
        common.settingsStore.delete('showOnlyWithHR');
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
    // If "Show All" is checked (or undefined/default), or no filters active, return unfiltered
    const showAll = settings.filterShowAll !== false; // Default to true if undefined
    const anyFilterActive = settings.filterOnlyWithHR || settings.filterInGroup ||
        settings.filterMarkedFollowing || settings.filterSameEvent ||
        (settings.filterByTeam && settings.filterTeamName);

    if (showAll || !anyFilterActive) {
        return riders;
    }

    return riders.filter(athlete => {
        // OR logic: rider passes if ANY enabled filter matches

        if (settings.filterOnlyWithHR) {
            if (athlete.state?.heartrate > 0) {
                return true;
            }
        }

        if (settings.filterInGroup) {
            // Check if athlete is in same group as watching
            // Group membership determined by gap distance threshold (~3 seconds)
            if (watchingAthlete && Math.abs(athlete.gap) <= 3) {
                return true;
            }
        }

        if (settings.filterMarkedFollowing) {
            if (athlete.athlete?.marked || athlete.athlete?.following) {
                return true;
            }
        }

        if (settings.filterSameEvent) {
            if (watchingAthlete?.state?.eventSubgroupId &&
                athlete.state?.eventSubgroupId === watchingAthlete.state.eventSubgroupId) {
                return true;
            }
        }

        if (settings.filterByTeam && settings.filterTeamName) {
            const teamFilter = settings.filterTeamName.toLowerCase();
            if (athlete.athlete?.team?.toLowerCase().includes(teamFilter)) {
                return true;
            }
        }

        return false; // No filter matched
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

function setupMainWindowFilters() {
    const filterCheckboxes = document.querySelectorAll('.filter-bar input[type="checkbox"]');

    filterCheckboxes.forEach(checkbox => {
        const settingKey = checkbox.dataset.setting;

        // Sync initial state from settings (filterShowAll defaults to true)
        const value = common.settingsStore.get(settingKey);
        if (settingKey === 'filterShowAll') {
            checkbox.checked = value !== false; // Default to checked if undefined
        } else {
            checkbox.checked = !!value;
        }

        // Update settings on change
        checkbox.addEventListener('change', () => {
            common.settingsStore.set(settingKey, checkbox.checked);
        });
    });
}

function syncFilterCheckboxes() {
    const filterCheckboxes = document.querySelectorAll('.filter-bar input[type="checkbox"]');
    filterCheckboxes.forEach(checkbox => {
        const settingKey = checkbox.dataset.setting;
        const value = common.settingsStore.get(settingKey);
        if (settingKey === 'filterShowAll') {
            checkbox.checked = value !== false;
        } else {
            checkbox.checked = !!value;
        }
    });
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

        // Add watching indicator
        if (athlete.watching) {
            row.classList.add('watching');
        }

        row.appendChild(nameCell);
        row.appendChild(hrCell);
        for (const cell of powerCells) {
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

    // Rebuild headers: Rider, %HR, then power columns
    thead.innerHTML = '<th>Rider</th><th>%HR</th>';
    for (const col of enabledPowerColumns) {
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
    await common.initSettingsForm('form#filter-options')();

    loadStoredMaxHRData();
    loadStoredMaxPowerData();
    renderAthleteMaxList();
    setupBackgroundOptionToggle();
    setupAthleteSearch();

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

    // Add header row
    const headerRow = document.createElement('div');
    headerRow.className = 'athlete-max-row athlete-max-header';
    headerRow.innerHTML = `
        <div class="athlete-info"><span class="header-label">Athlete</span></div>
        <span class="header-label hr-header">HR</span>
        <div class="power-inputs header-power">
            ${POWER_COLUMNS.map(col => `<span class="header-label">${col.label}</span>`).join('')}
        </div>
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
        row.appendChild(hrInput);
        row.appendChild(powerInputs);
        row.appendChild(deleteBtn);
        container.appendChild(row);
    }
}
