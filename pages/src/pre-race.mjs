import * as common from '/pages/src/common.mjs';

// Storage keys (global, shared across windows)
const ATHLETE_DATA_KEY = '/hr-zone-monitor-athlete-data';
const GOTTA_AUTH_KEY = '/hr-zone-monitor-gotta-auth';
const GOTTA_API_URL = 'https://app.gotta.bike';

// PreRace-specific settings
const PRERACE_SETTINGS_KEY = '/pre-race-settings';

// Background color options
const BACKGROUND_OPTIONS = {
    black: { name: 'Black', color: '#000000' },
    transparent: { name: 'Transparent', color: null },
    sauce: { name: 'Sauce Default', color: '#232323' },
    darkGray: { name: 'Dark Gray', color: '#1a1a1a' },
    darkBlue: { name: 'Dark Blue', color: '#0d1b2a' },
    darkGreen: { name: 'Dark Green', color: '#1a2e1a' },
    custom: { name: 'Custom', color: null }  // Uses customBackgroundColor
};

// State
let currentEvent = null;
let currentEntrants = [];
let storedAthleteData = {};
let heatmapChart = null;
let currentSort = { column: 'wkg60', ascending: false };

// All available columns for the heatmap
// Categories: power_watts, power_wkg, power_model, profile, race_stats, race_ranking, physical
const AVAILABLE_COLUMNS = [
    // Power (Watts)
    { id: 'w5', label: '5s W', category: 'power_watts', dataKey: 'power_w5', format: 'watts' },
    { id: 'w15', label: '15s W', category: 'power_watts', dataKey: 'power_w15', format: 'watts' },
    { id: 'w30', label: '30s W', category: 'power_watts', dataKey: 'power_w30', format: 'watts' },
    { id: 'w60', label: '1m W', category: 'power_watts', dataKey: 'power_w60', format: 'watts' },
    { id: 'w120', label: '2m W', category: 'power_watts', dataKey: 'power_w120', format: 'watts' },
    { id: 'w300', label: '5m W', category: 'power_watts', dataKey: 'power_w300', format: 'watts' },
    { id: 'w1200', label: '20m W', category: 'power_watts', dataKey: 'power_w1200', format: 'watts' },

    // Power (W/kg)
    { id: 'wkg5', label: '5s W/kg', category: 'power_wkg', dataKey: 'power_wkg5', format: 'wkg' },
    { id: 'wkg15', label: '15s W/kg', category: 'power_wkg', dataKey: 'power_wkg15', format: 'wkg' },
    { id: 'wkg30', label: '30s W/kg', category: 'power_wkg', dataKey: 'power_wkg30', format: 'wkg' },
    { id: 'wkg60', label: '1m W/kg', category: 'power_wkg', dataKey: 'power_wkg60', format: 'wkg' },
    { id: 'wkg120', label: '2m W/kg', category: 'power_wkg', dataKey: 'power_wkg120', format: 'wkg' },
    { id: 'wkg300', label: '5m W/kg', category: 'power_wkg', dataKey: 'power_wkg300', format: 'wkg' },
    { id: 'wkg1200', label: '20m W/kg', category: 'power_wkg', dataKey: 'power_wkg1200', format: 'wkg' },

    // Power Model
    { id: 'ftp', label: 'FTP', category: 'power_model', dataKey: 'zpFTP', format: 'watts' },
    { id: 'cp', label: 'CP', category: 'power_model', dataKey: 'power_CP', format: 'watts' },
    { id: 'awc', label: "W'", category: 'power_model', dataKey: 'power_AWC', format: 'number', suffix: 'J' },
    { id: 'powerRating', label: 'Power Rating', category: 'power_model', dataKey: 'power_powerRating', format: 'decimal1' },
    { id: 'compoundScore', label: 'Compound', category: 'power_model', dataKey: 'power_compoundScore', format: 'decimal1' },

    // Physical
    { id: 'weight', label: 'Weight', category: 'physical', dataKey: 'weight', format: 'decimal1', suffix: 'kg' },
    { id: 'height', label: 'Height', category: 'physical', dataKey: 'height', format: 'decimal1', suffix: 'cm' },

    // Phenotype Scores
    { id: 'phenoSprinter', label: 'Sprinter', category: 'phenotype', dataKey: 'phenotype_scores_sprinter', format: 'decimal1' },
    { id: 'phenoPuncheur', label: 'Puncheur', category: 'phenotype', dataKey: 'phenotype_scores_puncheur', format: 'decimal1' },
    { id: 'phenoPursuiter', label: 'Pursuiter', category: 'phenotype', dataKey: 'phenotype_scores_pursuiter', format: 'decimal1' },
    { id: 'phenoTT', label: 'TT', category: 'phenotype', dataKey: 'phenotype_scores_tt', format: 'decimal1' },
    { id: 'phenoClimber', label: 'Climber', category: 'phenotype', dataKey: 'phenotype_scores_climber', format: 'decimal1' },

    // Profile Suitability (stored as 0-1, display as percentage)
    { id: 'profileFlat', label: 'Flat %', category: 'profile', dataKey: 'handicaps_profile_flat', format: 'percent' },
    { id: 'profileRolling', label: 'Rolling %', category: 'profile', dataKey: 'handicaps_profile_rolling', format: 'percent' },
    { id: 'profileHilly', label: 'Hilly %', category: 'profile', dataKey: 'handicaps_profile_hilly', format: 'percent' },
    { id: 'profileMountain', label: 'Mountain %', category: 'profile', dataKey: 'handicaps_profile_mountainous', format: 'percent' },

    // Race Statistics
    { id: 'raceFinishes', label: 'Finishes', category: 'race_stats', dataKey: 'race_finishes', format: 'number' },
    { id: 'raceWins', label: 'Wins', category: 'race_stats', dataKey: 'race_wins', format: 'number' },
    { id: 'racePodiums', label: 'Podiums', category: 'race_stats', dataKey: 'race_podiums', format: 'number' },
    { id: 'raceDNFs', label: 'DNFs', category: 'race_stats', dataKey: 'race_dnfs', format: 'number' },

    // Race Ranking - Current
    { id: 'raceRating', label: 'Rating', category: 'race_ranking', dataKey: 'race_current_rating', format: 'decimal1' },
    { id: 'raceRating30', label: 'Rating 30d', category: 'race_ranking', dataKey: 'race_max30_rating', format: 'decimal1' },
    { id: 'raceRating90', label: 'Rating 90d', category: 'race_ranking', dataKey: 'race_max90_rating', format: 'decimal1' },
];

// Column categories for grouping in UI
const COLUMN_CATEGORIES = {
    power_watts: 'Power (Watts)',
    power_wkg: 'Power (W/kg)',
    power_model: 'Power Model',
    physical: 'Physical',
    phenotype: 'Phenotype',
    profile: 'Profile Suitability',
    race_stats: 'Race Stats',
    race_ranking: 'Race Ranking'
};

// Default selected columns
const DEFAULT_COLUMNS = ['wkg5', 'wkg15', 'wkg60', 'wkg300', 'w5', 'w15', 'w60', 'w300'];

// Default settings - set at module level
common.settingsStore.setDefault({
    fontScale: 1,
    maxRiders: 100,
    backgroundOption: 'black',  // Default to black
    customBackgroundColor: '#232323',
    // Selected columns (array of column IDs) - stored as JSON string
    selectedColumns: JSON.stringify(DEFAULT_COLUMNS),
    // Sort defaults
    defaultSortColumn: 'wkg60',
    defaultSortAscending: 'false'
});

/**
 * Main entry point for PreRace window
 */
export async function preRaceMain() {
    common.initInteractionListeners();

    // Load stored athlete data
    loadStoredAthleteData();

    // Apply font scale
    const fontScale = common.settingsStore.get('fontScale') || 1;
    document.documentElement.style.setProperty('--font-scale', fontScale);

    // Apply background color
    applyBackground();

    // Load sort preference
    currentSort.column = common.settingsStore.get('defaultSortColumn') || 'wkg60';
    currentSort.ascending = common.settingsStore.get('defaultSortAscending') === 'true';

    // Setup UI
    await setupEventSelector();
    setupImportButton();

    // Listen for settings changes
    common.settingsStore.addEventListener('changed', ev => {
        const changed = ev.data.changed;
        if (changed.has('fontScale')) {
            document.documentElement.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
        }
        if (changed.has('backgroundOption') || changed.has('customBackgroundColor')) {
            applyBackground();
        }
        // Re-render heatmap if column visibility or thresholds changed
        if (currentEntrants.length > 0) {
            renderHeatmap();
        }
    });

    // Listen for athlete data updates from other windows
    common.settingsStore.addEventListener('set', ev => {
        if (ev.data.key === ATHLETE_DATA_KEY) {
            storedAthleteData = ev.data.value || {};
            if (currentEntrants.length > 0) {
                renderHeatmap();
            }
        }
    });
}

/**
 * Apply background color based on settings
 */
function applyBackground() {
    const doc = document.documentElement;
    const option = common.settingsStore.get('backgroundOption') || 'black';
    let color = null;

    if (option === 'custom') {
        color = common.settingsStore.get('customBackgroundColor') || '#232323';
    } else if (BACKGROUND_OPTIONS[option]) {
        color = BACKGROUND_OPTIONS[option].color;
    }

    if (color) {
        doc.style.setProperty('--background-color', color);
        document.body.classList.remove('transparent-bg');
        document.body.classList.add('solid-background');
    } else {
        document.body.classList.add('transparent-bg');
        document.body.classList.remove('solid-background');
        doc.style.removeProperty('--background-color');
    }
}

/**
 * Main entry point for PreRace Settings window
 */
export async function preRaceSettingsMain() {
    common.initInteractionListeners();

    // Setup tab navigation
    setupTabNavigation();

    // Bind forms to settings
    await common.initSettingsForm('form#display-options')();
    await common.initSettingsForm('form#sort-options')();

    // Setup background option toggle
    setupBackgroundOptionToggle();

    // Setup column picker
    setupColumnPicker();

    // Setup GOTTA.BIKE auth and lookup
    setupGottaBikeAuth();
    setupGottaAthleteLookup();
}

/**
 * Setup background option toggle to show/hide custom color input
 */
function setupBackgroundOptionToggle() {
    const bgSelect = document.querySelector('select[name="backgroundOption"]');
    const customColorRow = document.querySelector('.custom-color-row');

    if (!bgSelect || !customColorRow) return;

    function updateCustomColorVisibility() {
        customColorRow.style.display = bgSelect.value === 'custom' ? 'flex' : 'none';
    }

    // Initial state
    updateCustomColorVisibility();

    // Listen for changes
    bgSelect.addEventListener('change', updateCustomColorVisibility);
}

/**
 * Setup tab navigation
 */
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
                if (panel.id === targetTab) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });
}

/**
 * Setup the column picker UI
 */
function setupColumnPicker() {
    const availableList = document.getElementById('available-columns');
    const selectedList = document.getElementById('selected-columns');
    const categoryFilter = document.getElementById('available-category');
    const addBtn = document.getElementById('add-column-btn');
    const removeBtn = document.getElementById('remove-column-btn');
    const moveUpBtn = document.getElementById('move-up-btn');
    const moveDownBtn = document.getElementById('move-down-btn');
    const resetBtn = document.getElementById('reset-columns-btn');
    const sortSelect = document.getElementById('sort-column-select');

    if (!availableList || !selectedList) return;

    // Populate category filter
    if (categoryFilter) {
        for (const [key, name] of Object.entries(COLUMN_CATEGORIES)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = name;
            categoryFilter.appendChild(option);
        }
        categoryFilter.addEventListener('change', () => renderAvailableColumns());
    }

    // Get current selected columns
    function getSelectedColumnIds() {
        const stored = common.settingsStore.get('selectedColumns');
        try {
            const ids = typeof stored === 'string' ? JSON.parse(stored) : stored;
            return Array.isArray(ids) ? ids : DEFAULT_COLUMNS;
        } catch (e) {
            return DEFAULT_COLUMNS;
        }
    }

    // Save selected columns
    function saveSelectedColumns(ids) {
        common.settingsStore.set('selectedColumns', JSON.stringify(ids));
        updateSortColumnSelect();
    }

    // Render available columns (not already selected)
    function renderAvailableColumns() {
        const selectedIds = getSelectedColumnIds();
        const categoryValue = categoryFilter?.value || '';

        availableList.innerHTML = '';
        for (const col of AVAILABLE_COLUMNS) {
            if (selectedIds.includes(col.id)) continue;
            if (categoryValue && col.category !== categoryValue) continue;

            const item = document.createElement('div');
            item.className = 'column-item';
            item.dataset.id = col.id;
            item.innerHTML = `
                <span class="column-name">${col.label}</span>
                <span class="column-category">${COLUMN_CATEGORIES[col.category] || col.category}</span>
            `;
            item.addEventListener('click', () => {
                availableList.querySelectorAll('.column-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
            item.addEventListener('dblclick', () => addColumn(col.id));
            availableList.appendChild(item);
        }
    }

    // Render selected columns
    function renderSelectedColumns() {
        const selectedIds = getSelectedColumnIds();

        selectedList.innerHTML = '';
        for (const id of selectedIds) {
            const col = AVAILABLE_COLUMNS.find(c => c.id === id);
            if (!col) continue;

            const item = document.createElement('div');
            item.className = 'column-item';
            item.dataset.id = col.id;
            item.innerHTML = `
                <span class="column-name">${col.label}</span>
                <span class="column-category">${COLUMN_CATEGORIES[col.category] || col.category}</span>
            `;
            item.addEventListener('click', () => {
                selectedList.querySelectorAll('.column-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
            item.addEventListener('dblclick', () => removeColumn(col.id));
            selectedList.appendChild(item);
        }
    }

    // Add column to selected
    function addColumn(id) {
        const selectedIds = getSelectedColumnIds();
        if (!selectedIds.includes(id)) {
            selectedIds.push(id);
            saveSelectedColumns(selectedIds);
            renderAvailableColumns();
            renderSelectedColumns();
        }
    }

    // Remove column from selected
    function removeColumn(id) {
        let selectedIds = getSelectedColumnIds();
        selectedIds = selectedIds.filter(i => i !== id);
        if (selectedIds.length === 0) {
            selectedIds = [DEFAULT_COLUMNS[0]]; // Keep at least one
        }
        saveSelectedColumns(selectedIds);
        renderAvailableColumns();
        renderSelectedColumns();
    }

    // Move column up
    function moveUp() {
        const selected = selectedList.querySelector('.column-item.selected');
        if (!selected) return;

        const selectedIds = getSelectedColumnIds();
        const id = selected.dataset.id;
        const index = selectedIds.indexOf(id);
        if (index > 0) {
            selectedIds.splice(index, 1);
            selectedIds.splice(index - 1, 0, id);
            saveSelectedColumns(selectedIds);
            renderSelectedColumns();
            // Re-select the item
            selectedList.querySelector(`[data-id="${id}"]`)?.classList.add('selected');
        }
    }

    // Move column down
    function moveDown() {
        const selected = selectedList.querySelector('.column-item.selected');
        if (!selected) return;

        const selectedIds = getSelectedColumnIds();
        const id = selected.dataset.id;
        const index = selectedIds.indexOf(id);
        if (index < selectedIds.length - 1) {
            selectedIds.splice(index, 1);
            selectedIds.splice(index + 1, 0, id);
            saveSelectedColumns(selectedIds);
            renderSelectedColumns();
            // Re-select the item
            selectedList.querySelector(`[data-id="${id}"]`)?.classList.add('selected');
        }
    }

    // Update sort column select options
    function updateSortColumnSelect() {
        if (!sortSelect) return;

        const selectedIds = getSelectedColumnIds();
        const currentValue = sortSelect.value;

        sortSelect.innerHTML = '<option value="name">Name</option>';
        for (const id of selectedIds) {
            const col = AVAILABLE_COLUMNS.find(c => c.id === id);
            if (col) {
                const option = document.createElement('option');
                option.value = col.id;
                option.textContent = col.label;
                sortSelect.appendChild(option);
            }
        }

        // Restore selection if still valid
        if (selectedIds.includes(currentValue) || currentValue === 'name') {
            sortSelect.value = currentValue;
        }
    }

    // Button handlers
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const selected = availableList.querySelector('.column-item.selected');
            if (selected) addColumn(selected.dataset.id);
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            const selected = selectedList.querySelector('.column-item.selected');
            if (selected) removeColumn(selected.dataset.id);
        });
    }

    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', moveUp);
    }

    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', moveDown);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            saveSelectedColumns([...DEFAULT_COLUMNS]);
            renderAvailableColumns();
            renderSelectedColumns();
        });
    }

    // Initial render
    renderAvailableColumns();
    renderSelectedColumns();
    updateSortColumnSelect();
}

/**
 * Load stored athlete data
 */
function loadStoredAthleteData() {
    storedAthleteData = common.settingsStore.get(ATHLETE_DATA_KEY) || {};
}

/**
 * Save stored athlete data
 */
function saveStoredAthleteData() {
    common.settingsStore.set(ATHLETE_DATA_KEY, storedAthleteData);
}

/**
 * Setup event selector UI
 */
async function setupEventSelector() {
    // Load cached events
    await loadCachedEvents();

    const loadBtn = document.getElementById('load-event-btn');
    const eventInput = document.getElementById('event-input');
    const cachedSelect = document.getElementById('cached-events');
    const subgroupSelect = document.getElementById('subgroup-select');

    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const input = eventInput.value.trim();
            if (input) {
                const eventId = parseEventInput(input);
                if (eventId) {
                    loadEvent(eventId);
                } else {
                    showError('Invalid event ID or URL');
                }
            }
        });
    }

    if (eventInput) {
        eventInput.addEventListener('keypress', ev => {
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
            }
        });
    }
}

/**
 * Setup import button
 */
function setupImportButton() {
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            if (!currentEntrants || currentEntrants.length === 0) {
                setImportStatus('error', 'No entrants to import');
                return;
            }

            const athleteIds = currentEntrants
                .map(e => e.id || e.athleteId)
                .filter(id => id && id > 0);

            if (athleteIds.length === 0) {
                setImportStatus('error', 'No valid athlete IDs found');
                return;
            }

            importBtn.disabled = true;
            importBtn.textContent = 'Importing...';
            setImportStatus('', `Importing ${athleteIds.length} athletes...`);

            try {
                const results = await bulkImportFromGotta(athleteIds, (current, total) => {
                    setImportStatus('', `Importing ${current} of ${total}...`);
                });

                if (results.success > 0) {
                    let message = `Imported ${results.success} athletes`;
                    if (results.failed > 0) {
                        message += `, ${results.failed} not found`;
                    }
                    setImportStatus('success', message);
                    renderHeatmap();
                } else {
                    setImportStatus('error', 'No athletes found in GOTTA.BIKE');
                }
            } catch (error) {
                console.error('Bulk import error:', error);
                setImportStatus('error', error.message);
            } finally {
                importBtn.disabled = false;
                importBtn.textContent = 'Import Data';
            }
        });
    }
}

/**
 * Set import status message
 */
function setImportStatus(state, message) {
    const statusEl = document.getElementById('import-status');
    if (statusEl) {
        statusEl.className = state;
        statusEl.textContent = message;
    }
}

/**
 * Load cached events
 */
async function loadCachedEvents() {
    try {
        const cachedEvents = await common.rpc.getCachedEvents();
        const select = document.getElementById('cached-events');
        if (!select) return;

        select.innerHTML = '<option value="">-- Cached Events --</option>';

        if (cachedEvents && cachedEvents.length > 0) {
            cachedEvents.sort((a, b) => new Date(b.eventStart) - new Date(a.eventStart));

            for (const event of cachedEvents) {
                const opt = document.createElement('option');
                opt.value = event.id;
                const startDate = new Date(event.eventStart);
                opt.textContent = `${event.name} (${formatDate(startDate)})`;
                select.appendChild(opt);
            }
        }
    } catch (err) {
        console.error('Failed to load cached events:', err);
    }
}

/**
 * Parse event input (ID or URL)
 */
function parseEventInput(input) {
    const numericId = parseInt(input);
    if (!isNaN(numericId) && numericId > 0) {
        return numericId;
    }

    const urlMatch = input.match(/zwift\.com\/events\/view\/(\d+)/i);
    if (urlMatch) {
        return parseInt(urlMatch[1]);
    }

    const inviteMatch = input.match(/events\/view\/(\d+)/i);
    if (inviteMatch) {
        return parseInt(inviteMatch[1]);
    }

    return null;
}

/**
 * Load event by ID
 */
async function loadEvent(eventId) {
    showLoading(true);
    hideError();

    try {
        const event = await common.rpc.getEvent(eventId);

        if (!event) {
            showError(`Event ${eventId} not found`);
            return;
        }

        currentEvent = event;
        displayEventInfo(event);
    } catch (err) {
        console.error('Failed to load event:', err);
        showError(`Failed to load event: ${err.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Display event info
 */
function displayEventInfo(event) {
    document.getElementById('event-name').textContent = event.name;

    const subgroupSelect = document.getElementById('subgroup-select');
    subgroupSelect.innerHTML = '<option value="">-- Select Category --</option>';
    subgroupSelect.disabled = false;

    if (event.eventSubgroups && event.eventSubgroups.length > 0) {
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
    document.getElementById('entrant-count').textContent = '0';
    document.getElementById('import-btn').disabled = true;
    document.getElementById('heatmap-container').hidden = true;
    document.getElementById('no-data').hidden = true;
}

/**
 * Load subgroup entrants
 */
async function loadSubgroupEntrants(subgroupId) {
    showLoading(true);

    try {
        const entrants = await common.rpc.getEventSubgroupEntrants(subgroupId);
        currentEntrants = entrants || [];

        document.getElementById('entrant-count').textContent = currentEntrants.length;
        document.getElementById('import-btn').disabled = currentEntrants.length === 0;

        // Check if we already have data for some entrants
        const hasData = currentEntrants.some(e => {
            const id = e.id || e.athleteId;
            return storedAthleteData[id];
        });

        if (hasData) {
            renderHeatmap();
        } else {
            document.getElementById('heatmap-container').hidden = true;
            document.getElementById('no-data').hidden = false;
        }
    } catch (err) {
        console.error('Failed to load entrants:', err);
        showError(`Failed to load entrants: ${err.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Bulk import athlete data from GOTTA.BIKE
 */
async function bulkImportFromGotta(athleteIds, progressCallback) {
    const authData = common.settingsStore.get(GOTTA_AUTH_KEY);

    if (!authData?.api_key) {
        throw new Error('Not authenticated with GOTTA.BIKE. Please authenticate in PreRace Settings (GOTTA.BIKE tab).');
    }

    // Check if token is expired
    if (authData.expires_at && Date.now() > authData.expires_at) {
        throw new Error('API key expired. Please re-authenticate in PreRace Settings.');
    }

    const results = { success: 0, failed: 0 };
    const batchSize = 50;

    for (let i = 0; i < athleteIds.length; i += batchSize) {
        const batch = athleteIds.slice(i, i + batchSize);

        if (progressCallback) {
            progressCallback(Math.min(i + batchSize, athleteIds.length), athleteIds.length);
        }

        try {
            const response = await fetch(`${GOTTA_API_URL}/api_v1/zrapp/riders_sauce_mod`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sauce-API-Key': authData.api_key
                },
                body: JSON.stringify({ rider_ids: batch })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication expired. Please re-authenticate in PreRace Settings.');
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.riders && Array.isArray(data.riders)) {
                for (const rider of data.riders) {
                    if (rider && rider.riderId) {
                        importAthleteData(rider);
                        results.success++;
                    }
                }
            }

            results.failed += batch.length - (data.riders?.length || 0);
        } catch (err) {
            console.error('Batch import error:', err);
            throw err;
        }
    }

    saveStoredAthleteData();
    return results;
}

/**
 * Import single athlete data from API response
 */
function importAthleteData(riderData) {
    const athleteId = riderData.riderId;
    if (!athleteId) return;

    const flatData = {
        riderId: athleteId,
        name: riderData.name,
        gender: riderData.gender,
        country: riderData.country,
        height: riderData.height,
        weight: riderData.weight,
        zpCategory: riderData.zpCategory,
        zpFTP: riderData.zpFTP,
        importedAt: Date.now()
    };

    // Power data
    if (riderData.power) {
        flatData.power_CP = riderData.power.CP;
        flatData.power_AWC = riderData.power.AWC;
        flatData.power_powerRating = riderData.power.powerRating;
        flatData.power_compoundScore = riderData.power.compoundScore;
        flatData.power_w5 = riderData.power.w5;
        flatData.power_w15 = riderData.power.w15;
        flatData.power_w30 = riderData.power.w30;
        flatData.power_w60 = riderData.power.w60;
        flatData.power_w120 = riderData.power.w120;
        flatData.power_w300 = riderData.power.w300;
        flatData.power_w1200 = riderData.power.w1200;
        flatData.power_wkg5 = riderData.power.wkg5;
        flatData.power_wkg15 = riderData.power.wkg15;
        flatData.power_wkg30 = riderData.power.wkg30;
        flatData.power_wkg60 = riderData.power.wkg60;
        flatData.power_wkg120 = riderData.power.wkg120;
        flatData.power_wkg300 = riderData.power.wkg300;
        flatData.power_wkg1200 = riderData.power.wkg1200;
    }

    storedAthleteData[athleteId] = flatData;
}

/**
 * Get the list of selected columns from settings
 */
function getSelectedColumns() {
    const stored = common.settingsStore.get('selectedColumns');
    let selectedIds;
    try {
        selectedIds = typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (e) {
        selectedIds = DEFAULT_COLUMNS;
    }
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
        selectedIds = DEFAULT_COLUMNS;
    }
    // Map IDs to column objects, preserving order
    return selectedIds
        .map(id => AVAILABLE_COLUMNS.find(col => col.id === id))
        .filter(col => col !== undefined);
}

/**
 * Format a value based on column format type
 */
function formatColumnValue(value, col) {
    if (value === null || value === undefined) return '';
    switch (col.format) {
        case 'watts':
            return Math.round(value);
        case 'wkg':
            return value.toFixed(1);
        case 'decimal1':
            return value.toFixed(1);
        case 'decimal2':
            return value.toFixed(2);
        case 'percent':
            return (value * 100).toFixed(0);
        case 'number':
        default:
            return Math.round(value);
    }
}

/**
 * Render the heatmap chart
 * Rows = riders, Columns = selected metrics
 * Color scale: min (red) -> median (yellow) -> max (green) per column
 */
function renderHeatmap() {
    const container = document.getElementById('heatmap-chart');
    if (!container) return;

    // Get selected columns from settings
    const visibleColumns = getSelectedColumns();

    if (visibleColumns.length === 0) {
        document.getElementById('heatmap-container').hidden = true;
        document.getElementById('no-data').hidden = false;
        return;
    }

    // Build data for heatmap
    const maxRiders = common.settingsStore.get('maxRiders') || 100;
    let riders = currentEntrants
        .map(e => {
            const id = e.id || e.athleteId;
            const athleteData = storedAthleteData[id];
            if (!athleteData) return null;

            const name = athleteData.name || e.firstName || `Athlete ${id}`;
            return { id, name, athleteData, entrant: e };
        })
        .filter(r => r !== null);

    // Sort riders
    riders = sortRiders(riders, visibleColumns);

    // Limit riders
    riders = riders.slice(0, maxRiders);

    if (riders.length === 0) {
        document.getElementById('heatmap-container').hidden = true;
        document.getElementById('no-data').hidden = false;
        return;
    }

    document.getElementById('heatmap-container').hidden = false;
    document.getElementById('no-data').hidden = true;

    // Calculate column statistics (min, max, median) for color scaling
    const columnStats = {};
    for (const col of visibleColumns) {
        const values = riders
            .map(r => r.athleteData[col.dataKey])
            .filter(v => v !== undefined && v !== null && v > 0)
            .sort((a, b) => a - b);

        if (values.length > 0) {
            const min = values[0];
            const max = values[values.length - 1];
            const midIndex = Math.floor(values.length / 2);
            const median = values.length % 2 === 0
                ? (values[midIndex - 1] + values[midIndex]) / 2
                : values[midIndex];
            columnStats[col.id] = { min, max, median };
        } else {
            columnStats[col.id] = { min: 0, max: 100, median: 50 };
        }
    }

    // Build series data for ApexCharts heatmap
    // Each series is a rider (row), with data points for each column
    const series = riders.map(rider => {
        const data = visibleColumns.map(col => {
            const rawValue = rider.athleteData[col.dataKey];
            const value = rawValue !== undefined && rawValue !== null ? Number(rawValue) : null;

            // Normalize value to 0-100 scale based on column stats
            // 0 = min (red), 50 = median (yellow), 100 = max (green)
            let normalizedValue = null;
            if (value !== null && value > 0) {
                const stats = columnStats[col.id];
                if (value <= stats.median) {
                    // Scale from min (0) to median (50)
                    if (stats.median > stats.min) {
                        normalizedValue = ((value - stats.min) / (stats.median - stats.min)) * 50;
                    } else {
                        normalizedValue = 50;
                    }
                } else {
                    // Scale from median (50) to max (100)
                    if (stats.max > stats.median) {
                        normalizedValue = 50 + ((value - stats.median) / (stats.max - stats.median)) * 50;
                    } else {
                        normalizedValue = 100;
                    }
                }
            }

            return {
                x: col.label,
                y: normalizedValue,
                rawValue: value,
                colId: col.id,
                colFormat: col.format,
                colSuffix: col.suffix || ''
            };
        });
        return { name: rider.name, data };
    });

    const options = {
        chart: {
            type: 'heatmap',
            height: Math.max(400, riders.length * 28 + 80),
            toolbar: { show: false },
            background: 'transparent',
            events: {
                dataPointSelection: (event, chartContext, config) => {
                    const colIndex = config.dataPointIndex;
                    const col = visibleColumns[colIndex];
                    if (col) {
                        handleColumnClick(col.id);
                    }
                }
            }
        },
        dataLabels: {
            enabled: true,
            style: {
                colors: ['#fff'],
                fontSize: '10px',
                fontWeight: 400
            },
            formatter: (val, opts) => {
                // Get the raw value from the data
                const dataPoint = opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex];
                const rawValue = dataPoint?.rawValue;
                if (rawValue === null || rawValue === undefined) return '';
                const col = visibleColumns[opts.dataPointIndex];
                return formatColumnValue(rawValue, col);
            }
        },
        plotOptions: {
            heatmap: {
                shadeIntensity: 0.5,
                radius: 2,
                colorScale: {
                    ranges: [
                        { from: -1, to: 0, color: '#555555', name: 'No data' },
                        { from: 0, to: 10, color: '#FF2222', name: 'Very Low' },
                        { from: 10, to: 25, color: '#FF6633', name: 'Low' },
                        { from: 25, to: 40, color: '#FFAA33', name: 'Below Median' },
                        { from: 40, to: 60, color: '#FFDD44', name: 'Median' },
                        { from: 60, to: 75, color: '#BBDD33', name: 'Above Median' },
                        { from: 75, to: 90, color: '#77CC33', name: 'High' },
                        { from: 90, to: 101, color: '#33BB33', name: 'Very High' }
                    ]
                }
            }
        },
        series: series,
        xaxis: {
            type: 'category',
            position: 'top',
            labels: {
                style: {
                    colors: '#ccc',
                    fontSize: '11px'
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#ccc',
                    fontSize: '11px'
                },
                maxWidth: 150
            }
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
                const riderName = w.config.series[seriesIndex].name;
                const colLabel = dataPoint.x;
                const rawValue = dataPoint.rawValue;
                const colFormat = dataPoint.colFormat;
                const colSuffix = dataPoint.colSuffix;
                const colId = dataPoint.colId;
                const stats = columnStats[colId];
                const col = visibleColumns[dataPointIndex];

                let valueStr = 'No data';
                if (rawValue !== null && rawValue !== undefined) {
                    valueStr = formatColumnValue(rawValue, col);
                    // Add appropriate suffix for tooltip
                    if (colFormat === 'watts') {
                        valueStr += ' W';
                    } else if (colFormat === 'wkg') {
                        valueStr += ' W/kg';
                    } else if (colFormat === 'percent') {
                        valueStr += '%';
                    } else if (colSuffix) {
                        valueStr += ' ' + colSuffix;
                    }
                }

                let statsStr = '';
                if (stats) {
                    const formatStat = v => formatColumnValue(v, col);
                    statsStr = `
                        <div style="font-size:10px;color:#999;margin-top:4px;">
                            Min: ${formatStat(stats.min)} | Med: ${formatStat(stats.median)} | Max: ${formatStat(stats.max)}
                        </div>
                    `;
                }

                return `
                    <div style="padding:8px;">
                        <div style="font-weight:bold;margin-bottom:4px;">${riderName}</div>
                        <div>${colLabel}: <strong>${valueStr}</strong></div>
                        ${statsStr}
                    </div>
                `;
            }
        },
        legend: {
            show: false
        },
        grid: {
            padding: {
                right: 10,
                left: 10
            }
        },
        theme: {
            mode: 'dark'
        },
        states: {
            hover: {
                filter: {
                    type: 'lighten',
                    value: 0.1
                }
            }
        }
    };

    // Destroy existing chart if any
    if (heatmapChart) {
        heatmapChart.destroy();
    }

    heatmapChart = new ApexCharts(container, options);
    heatmapChart.render();

    // Add click handlers to x-axis labels for sorting
    setTimeout(() => {
        addColumnHeaderClickHandlers(container, visibleColumns);
    }, 100);
}

/**
 * Add click handlers to column headers (x-axis labels) for sorting
 */
function addColumnHeaderClickHandlers(container, visibleColumns) {
    const xaxisLabels = container.querySelectorAll('.apexcharts-xaxis-texts-g text');

    xaxisLabels.forEach((label, index) => {
        if (index < visibleColumns.length) {
            const col = visibleColumns[index];

            // Style the label to indicate it's clickable
            label.style.cursor = 'pointer';

            // Add sort indicator if this is the current sort column
            if (col.id === currentSort.column) {
                const arrow = currentSort.ascending ? ' ▲' : ' ▼';
                // Check if arrow already added
                if (!label.textContent.includes('▲') && !label.textContent.includes('▼')) {
                    label.textContent = label.textContent + arrow;
                }
            }

            // Add click handler
            label.onclick = (e) => {
                e.stopPropagation();
                handleColumnClick(col.id);
            };

            // Add hover effect
            label.onmouseenter = () => {
                label.style.fill = '#fff';
                label.style.fontWeight = 'bold';
            };
            label.onmouseleave = () => {
                label.style.fill = '#ccc';
                label.style.fontWeight = col.id === currentSort.column ? 'bold' : 'normal';
            };

            // Keep sorted column bold
            if (col.id === currentSort.column) {
                label.style.fontWeight = 'bold';
            }
        }
    });
}

/**
 * Sort riders by current sort column
 */
function sortRiders(riders, visibleColumns) {
    const sortCol = visibleColumns.find(c => c.id === currentSort.column);
    if (!sortCol) {
        // Fall back to first visible column
        if (visibleColumns.length > 0) {
            currentSort.column = visibleColumns[0].id;
        } else {
            return riders;
        }
    }

    const col = visibleColumns.find(c => c.id === currentSort.column) || visibleColumns[0];

    return [...riders].sort((a, b) => {
        const valA = a.athleteData[col.dataKey] ?? -Infinity;
        const valB = b.athleteData[col.dataKey] ?? -Infinity;

        if (currentSort.ascending) {
            return valA - valB;
        } else {
            return valB - valA;
        }
    });
}

/**
 * Handle column header click for sorting
 */
function handleColumnClick(columnId) {
    if (currentSort.column === columnId) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.column = columnId;
        currentSort.ascending = false;
    }
    renderHeatmap();
}

/**
 * Show/hide loading indicator
 */
function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.hidden = !show;
}

/**
 * Show error message
 */
function showError(message) {
    const el = document.getElementById('error');
    if (el) {
        el.textContent = message;
        el.hidden = false;
    }
}

/**
 * Hide error message
 */
function hideError() {
    const el = document.getElementById('error');
    if (el) el.hidden = true;
}

/**
 * Format date for display
 */
function formatDate(date) {
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

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
    importAthleteData(athlete);
    saveStoredAthleteData();

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

    // Power data section
    if (athlete.power) {
        html += '<div class="gotta-section-title">Power Data</div>';
        const powerFields = [
            { key: 'w5', label: '5s', suffix: 'W' },
            { key: 'w15', label: '15s', suffix: 'W' },
            { key: 'w60', label: '1m', suffix: 'W' },
            { key: 'w300', label: '5m', suffix: 'W' },
            { key: 'wkg5', label: '5s', suffix: 'W/kg', decimals: 2 },
            { key: 'wkg15', label: '15s', suffix: 'W/kg', decimals: 2 },
            { key: 'wkg60', label: '1m', suffix: 'W/kg', decimals: 2 },
            { key: 'wkg300', label: '5m', suffix: 'W/kg', decimals: 2 }
        ];

        for (const field of powerFields) {
            const value = athlete.power[field.key];
            if (value !== undefined && value !== null && value > 0) {
                const displayValue = field.decimals
                    ? `${value.toFixed(field.decimals)} ${field.suffix}`
                    : `${Math.round(value)} ${field.suffix}`;
                html += `
                    <div class="gotta-athlete-row">
                        <span class="gotta-label">${field.label}:</span>
                        <span class="gotta-value">${displayValue}</span>
                    </div>
                `;
            }
        }
    }

    html += '</div>';
    html += '<p class="import-note">Data imported to athlete storage.</p>';

    dataDiv.innerHTML = html;
    dataDiv.hidden = false;
}
