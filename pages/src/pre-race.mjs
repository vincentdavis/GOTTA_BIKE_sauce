import * as common from '/pages/src/common.mjs';

// Storage keys (global, shared across windows)
const ATHLETE_DATA_KEY = '/gotta-bike-sauce-athlete-data';
const GOTTA_AUTH_KEY = '/gotta-bike-sauce-auth';
const GOTTA_API_URL = 'https://app.gotta.bike';

// PreRace-specific settings
const PRERACE_SETTINGS_KEY = '/gotta-bike-sauce-prerace-settings';

// Power columns for athlete list display (maps to storedAthleteData fields)
const POWER_COLUMNS = [
    { key: 'power_w5', seconds: 5, label: '5s' },
    { key: 'power_w15', seconds: 15, label: '15s' },
    { key: 'power_w60', seconds: 60, label: '1m' },
    { key: 'power_w300', seconds: 300, label: '5m' },
    { key: 'power_w1200', seconds: 1200, label: '20m' }
];

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
let currentSort = { column: 'wkg60', ascending: false };
let teamSort = { column: 'team', ascending: true };

// All available columns for the heatmap
// Categories: info, power_watts, power_wkg, power_model, profile, race_stats, race_ranking, physical
const AVAILABLE_COLUMNS = [
    // Info (text columns - no heatmap coloring)
    { id: 'team', label: 'Team', category: 'info', dataKey: 'team', format: 'text' },
    { id: 'zpCategory', label: 'Category', category: 'info', dataKey: 'zpCategory', format: 'text' },

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

    // Phenotype
    { id: 'phenoType', label: 'Type', category: 'phenotype', dataKey: 'phenotype_value', format: 'text' },
    { id: 'phenoBias', label: 'Bias', category: 'phenotype', dataKey: 'phenotype_bias', format: 'decimal2' },
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
    { id: 'raceMixedCat', label: 'Mixed Cat', category: 'race_ranking', dataKey: 'race_current_mixed_category', format: 'text' },
    { id: 'raceMixedRank', label: 'Mixed Rank', category: 'race_ranking', dataKey: 'race_current_mixed_number', format: 'number' },
];

// Column categories for grouping in UI
const COLUMN_CATEGORIES = {
    info: 'Info',
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

    // Load stored data
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

    // Setup Known Athletes tab
    loadStoredAthleteData();
    setupAthleteSearch();
    setupAddRiderButton();
    renderAthleteMaxList();

    // Listen for storage changes to update athlete list
    common.settingsStore.addEventListener('set', ev => {
        if (ev.data.key === ATHLETE_DATA_KEY) {
            storedAthleteData = ev.data.value || {};
            renderAthleteMaxListWithCurrentSearch();
        }
    });
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
            console.log('[PreRace] Starting import of', athleteIds.length, 'athletes');

            try {
                const results = await bulkImportFromGotta(athleteIds, (current, total) => {
                    setImportStatus('', `Importing ${current} of ${total}...`);
                });
                console.log('[PreRace] Import results:', results);

                if (results.success > 0) {
                    let message = `Imported ${results.success} athletes`;
                    if (results.failed > 0) {
                        message += `, ${results.failed} not found`;
                    }
                    setImportStatus('success', message);
                    try {
                        renderHeatmap();
                    } catch (renderErr) {
                        console.error('Heatmap render error:', renderErr);
                        setImportStatus('error', `Import succeeded but display failed: ${renderErr.message}`);
                    }
                } else {
                    setImportStatus('error', 'No athletes found in GOTTA.BIKE');
                }
            } catch (error) {
                console.error('Bulk import error:', error);
                setImportStatus('error', error.message);
            } finally {
                console.log('[PreRace] Import finished, resetting button');
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
    console.log('[PreRace] bulkImportFromGotta called with', athleteIds.length, 'athletes');
    const authData = common.settingsStore.get(GOTTA_AUTH_KEY);
    console.log('[PreRace] Auth data:', authData ? { api_key: authData.api_key ? '***present***' : 'missing', expires_at: authData.expires_at } : 'null');

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
        console.log(`[PreRace] Processing batch ${i / batchSize + 1}, athletes ${i + 1}-${Math.min(i + batchSize, athleteIds.length)}`);

        if (progressCallback) {
            progressCallback(Math.min(i + batchSize, athleteIds.length), athleteIds.length);
        }

        try {
            console.log('[PreRace] Fetching from GOTTA.BIKE API...');
            const response = await fetch(`${GOTTA_API_URL}/api_v1/zrapp/riders_sauce_mod`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sauce-API-Key': authData.api_key
                },
                body: JSON.stringify({ rider_ids: batch })
            });
            console.log('[PreRace] API response status:', response.status);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication expired. Please re-authenticate in PreRace Settings.');
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('[PreRace] API returned', data.riders?.length || 0, 'riders');

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
            console.error('[PreRace] Batch import error:', err);
            throw err;
        }
    }

    console.log('[PreRace] All batches complete, saving data');
    saveStoredAthleteData();
    console.log('[PreRace] Data saved, returning results');
    return results;
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
 * Import single athlete data from API response
 * Stores all data in consolidated storedAthleteData structure
 * Preserves user-edited fields (marked in userEdited object)
 */
function importAthleteData(riderData) {
    if (!riderData || !riderData.riderId) return;

    const athleteId = riderData.riderId;

    // Get existing data to preserve user edits and local additions
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

    // Store ALL API fields, preserving user-edited values
    storedAthleteData[athleteId] = {
        ...riderData,
        name: name,
        team: team,
        // Preserve existing maxHR if user edited (not provided by API)
        maxHR: existingUserEdited.maxHR ? existingData.maxHR : (existingData.maxHR || null),
        // Preserve userEdited flags
        userEdited: existingUserEdited,
        // Add import timestamp
        importedAt: Date.now()
    };
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
        case 'text':
            return String(value);
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
 * Get color tier (0-7) based on normalized value (0-100)
 * Tier 0 = no data/text, Tier 1-7 = color gradient
 */
function getColorTier(normalizedValue) {
    if (normalizedValue === null || normalizedValue === undefined) return 0;
    if (normalizedValue < 0) return 0; // Text columns use -0.5
    if (normalizedValue < 10) return 1;
    if (normalizedValue < 25) return 2;
    if (normalizedValue < 40) return 3;
    if (normalizedValue < 60) return 4;
    if (normalizedValue < 75) return 5;
    if (normalizedValue < 90) return 6;
    return 7;
}

/**
 * Normalize a value to 0-100 scale based on column stats (min/median/max)
 */
function normalizeValue(value, stats) {
    if (value === null || value === undefined || value <= 0) return null;
    if (!stats) return null;

    if (value <= stats.median) {
        // Scale from min (0) to median (50)
        if (stats.median > stats.min) {
            return ((value - stats.min) / (stats.median - stats.min)) * 50;
        } else {
            return 50;
        }
    } else {
        // Scale from median (50) to max (100)
        if (stats.max > stats.median) {
            return 50 + ((value - stats.median) / (stats.max - stats.median)) * 50;
        } else {
            return 100;
        }
    }
}

/**
 * Build the table header row with sortable columns
 */
function buildTableHeader(visibleColumns) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');

    // Rider name column
    const riderTh = document.createElement('th');
    riderTh.className = 'rider-col';
    riderTh.textContent = 'Rider';
    tr.appendChild(riderTh);

    // Metric columns
    for (const col of visibleColumns) {
        const th = document.createElement('th');
        th.className = 'metric-col sortable';
        th.dataset.col = col.id;

        // Build header text with sort indicator
        let headerText = col.label;
        if (col.id === currentSort.column) {
            th.classList.add('sorted');
            headerText += currentSort.ascending ? ' ▲' : ' ▼';
        }
        th.textContent = headerText;

        // Click handler for sorting
        th.onclick = () => handleColumnClick(col.id);

        tr.appendChild(th);
    }

    thead.appendChild(tr);
    return thead;
}

/**
 * Build the table body with rider rows and colored cells
 */
function buildTableBody(riders, visibleColumns, columnStats) {
    const tbody = document.createElement('tbody');

    for (const rider of riders) {
        const tr = document.createElement('tr');

        // Rider name cell - clickable to show details
        const nameTd = document.createElement('td');
        nameTd.className = 'rider-name clickable';
        nameTd.textContent = rider.name;
        nameTd.title = 'Click to view all data';
        nameTd.dataset.riderId = rider.id;
        nameTd.dataset.riderName = rider.name;
        nameTd.onclick = () => showRiderModal(rider.id, rider.name);
        tr.appendChild(nameTd);

        // Metric cells
        for (const col of visibleColumns) {
            const td = document.createElement('td');
            td.className = 'metric-cell';

            let rawValue = rider.athleteData[col.dataKey];

            // Handle text columns differently - no color scaling
            if (col.format === 'text') {
                td.classList.add('color-tier-0');

                // Make team column editable
                if (col.id === 'team') {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'team-edit-input';
                    input.value = rawValue || '';
                    input.placeholder = 'Team';
                    input.dataset.riderId = rider.id;

                    // Save on blur or enter
                    const saveTeam = () => {
                        const newTeam = input.value.trim();
                        const athleteId = rider.id;
                        if (storedAthleteData[athleteId]) {
                            storedAthleteData[athleteId].team = newTeam || null;
                            storedAthleteData[athleteId].userEdited = storedAthleteData[athleteId].userEdited || {};
                            storedAthleteData[athleteId].userEdited.team = true;
                            saveStoredAthleteData();
                        }
                    };

                    input.addEventListener('blur', saveTeam);
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            input.blur();
                        }
                    });

                    td.appendChild(input);
                } else {
                    td.textContent = rawValue || '';
                }

                td.dataset.colId = col.id;
                td.dataset.colLabel = col.label;
                td.dataset.colFormat = col.format;
                td.dataset.colSuffix = col.suffix || '';
                td.dataset.rawValue = rawValue || '';
                td.dataset.riderName = rider.name;
                tr.appendChild(td);
                continue;
            }

            const value = rawValue !== undefined && rawValue !== null ? Number(rawValue) : null;
            const stats = columnStats[col.id];
            const normalizedValue = normalizeValue(value, stats);
            const colorTier = getColorTier(normalizedValue);

            td.classList.add(`color-tier-${colorTier}`);
            td.textContent = value !== null && value > 0 ? formatColumnValue(value, col) : '';

            // Store data for tooltip
            td.dataset.colId = col.id;
            td.dataset.colLabel = col.label;
            td.dataset.colFormat = col.format;
            td.dataset.colSuffix = col.suffix || '';
            td.dataset.rawValue = value !== null ? value : '';
            td.dataset.riderName = rider.name;

            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }

    return tbody;
}

/**
 * Build the table header row for team heatmap with sortable columns
 */
function buildTeamTableHeader(visibleColumns) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');

    // Team name column (sortable)
    const teamTh = document.createElement('th');
    teamTh.className = 'team-col sortable';
    teamTh.dataset.col = 'team';
    let teamHeaderText = 'Team';
    if (teamSort.column === 'team') {
        teamTh.classList.add('sorted');
        teamHeaderText += teamSort.ascending ? ' ▲' : ' ▼';
    }
    teamTh.textContent = teamHeaderText;
    teamTh.onclick = () => handleTeamColumnClick('team');
    tr.appendChild(teamTh);

    // Rider count column
    const countTh = document.createElement('th');
    countTh.className = 'metric-col';
    countTh.textContent = '#';
    countTh.title = 'Number of riders';
    tr.appendChild(countTh);

    // Metric columns (same as athlete heatmap, skip text columns)
    for (const col of visibleColumns) {
        if (col.format === 'text') continue;

        const th = document.createElement('th');
        th.className = 'metric-col sortable';
        th.dataset.col = col.id;

        let headerText = col.label;
        if (col.id === teamSort.column) {
            th.classList.add('sorted');
            headerText += teamSort.ascending ? ' ▲' : ' ▼';
        }
        th.textContent = headerText;
        th.onclick = () => handleTeamColumnClick(col.id);

        tr.appendChild(th);
    }

    thead.appendChild(tr);
    return thead;
}

/**
 * Build the table body for team heatmap with colored cells
 * Uses the SAME columnStats from athlete heatmap for consistent coloring
 * @param {Array} teams - Array of team aggregate objects
 * @param {Array} visibleColumns - Array of column definitions
 * @param {Object} columnStats - Column statistics for color scaling
 * @param {string} statType - Which stat to display: 'mean', 'max', or 'min'
 * @param {string} statLabel - Label for tooltip: 'Mean', 'Max', or 'Min'
 */
function buildTeamTableBody(teams, visibleColumns, columnStats, statType = 'mean', statLabel = 'Mean') {
    const tbody = document.createElement('tbody');

    for (const team of teams) {
        const tr = document.createElement('tr');

        // Team name cell
        const nameTd = document.createElement('td');
        nameTd.className = 'team-name-cell';
        nameTd.textContent = team.team;
        nameTd.title = `${team.riderCount} rider(s)`;
        tr.appendChild(nameTd);

        // Rider count cell
        const countTd = document.createElement('td');
        countTd.className = 'metric-cell color-tier-0';
        countTd.textContent = team.riderCount;
        tr.appendChild(countTd);

        // Metric cells (same coloring logic as athlete heatmap)
        for (const col of visibleColumns) {
            if (col.format === 'text') continue;

            const td = document.createElement('td');
            td.className = 'metric-cell';

            const value = team[statType]?.[col.dataKey];
            const stats = columnStats[col.id];
            const normalizedValue = normalizeValue(value, stats);
            const colorTier = getColorTier(normalizedValue);

            td.classList.add(`color-tier-${colorTier}`);
            td.textContent = value !== null && value > 0 ? formatColumnValue(value, col) : '';

            // Store data for tooltip
            td.dataset.colId = col.id;
            td.dataset.colLabel = col.label;
            td.dataset.colFormat = col.format;
            td.dataset.colSuffix = col.suffix || '';
            td.dataset.rawValue = value !== null ? value : '';
            td.dataset.riderName = `${team.team} (${statLabel})`;

            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }

    return tbody;
}

/**
 * Setup tooltip handlers for heatmap cells
 */
function setupCellTooltips(container, visibleColumns, columnStats) {
    const tooltip = document.getElementById('heatmap-tooltip');
    if (!tooltip) return;

    const cells = container.querySelectorAll('.metric-cell');

    cells.forEach(cell => {
        cell.addEventListener('mouseenter', (e) => {
            const colId = cell.dataset.colId;
            const colLabel = cell.dataset.colLabel || colId;
            const colFormat = cell.dataset.colFormat;
            const colSuffix = cell.dataset.colSuffix;
            const rawValue = cell.dataset.rawValue;
            const riderName = cell.dataset.riderName;
            const stats = columnStats[colId];
            const col = visibleColumns.find(c => c.id === colId);

            // Build tooltip content
            const riderDiv = tooltip.querySelector('.tooltip-rider');
            const metricDiv = tooltip.querySelector('.tooltip-metric');
            const statsDiv = tooltip.querySelector('.tooltip-stats');

            riderDiv.textContent = riderName;

            // Format value with appropriate suffix
            let valueStr = 'No data';
            if (rawValue !== '' && rawValue !== undefined) {
                // Text columns: display raw value as-is
                if (colFormat === 'text') {
                    valueStr = rawValue;
                } else {
                    valueStr = formatColumnValue(Number(rawValue), col);
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
            }
            metricDiv.innerHTML = `${colLabel}: <strong>${valueStr}</strong>`;

            // Stats for numeric columns
            if (stats && col) {
                const formatStat = v => formatColumnValue(v, col);
                statsDiv.textContent = `Min: ${formatStat(stats.min)} | Med: ${formatStat(stats.median)} | Max: ${formatStat(stats.max)}`;
            } else {
                statsDiv.textContent = '';
            }

            // Position tooltip
            tooltip.hidden = false;
            const rect = cell.getBoundingClientRect();
            tooltip.style.left = `${rect.right + 10}px`;
            tooltip.style.top = `${rect.top}px`;

            // Keep tooltip in viewport
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.right > window.innerWidth) {
                tooltip.style.left = `${rect.left - tooltipRect.width - 10}px`;
            }
            if (tooltipRect.bottom > window.innerHeight) {
                tooltip.style.top = `${window.innerHeight - tooltipRect.height - 10}px`;
            }
        });

        cell.addEventListener('mouseleave', () => {
            tooltip.hidden = true;
        });
    });
}

/**
 * Show modal with full rider details
 */
function showRiderModal(riderId, riderName) {
    const modal = document.getElementById('rider-modal');
    if (!modal) return;

    const titleEl = modal.querySelector('.rider-modal-title');
    const bodyEl = modal.querySelector('.rider-modal-body');
    const closeBtn = modal.querySelector('.rider-modal-close');

    // Set title
    titleEl.textContent = riderName;

    // Build profile links container
    const profileLinksHtml = `
        <div class="rider-profile-links">
            <a href="#" class="external-link" data-url="https://zwiftpower.com/profile.php?z=${riderId}">ZwiftPower</a>
            <a href="#" class="external-link" data-url="https://www.zwiftracing.app/riders/${riderId}">Zwift Racing</a>
        </div>
    `;

    // Get rider data
    const athleteData = storedAthleteData[riderId];

    if (athleteData) {
        bodyEl.innerHTML = profileLinksHtml + renderAthleteDetailsPanel(riderId, athleteData);
    } else {
        bodyEl.innerHTML = profileLinksHtml + '<div class="no-gotta-data">No extended data available. Import from GOTTA.BIKE to see additional fields.</div>';
    }

    // Add click handlers for external links to open in system browser
    bodyEl.querySelectorAll('.external-link').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const url = link.dataset.url;
            if (url && common.rpc.openExternalLink) {
                common.rpc.openExternalLink(url);
            } else {
                // Fallback to window.open if RPC not available
                window.open(url, '_blank');
            }
        };
    });

    // Show modal
    modal.hidden = false;

    // Close handlers
    const closeModal = () => {
        modal.hidden = true;
    };

    closeBtn.onclick = closeModal;

    // Close on overlay click (but not modal content click)
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };

    // Close on Escape key
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    document.addEventListener('keydown', handleKeydown);
}

/**
 * Render the heatmap table
 * Rows = riders, Columns = selected metrics
 * Color scale: green (low) -> yellow (median) -> red (high) per column
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
    // Skip text columns - they don't have numeric stats
    const columnStats = {};
    for (const col of visibleColumns) {
        if (col.format === 'text') {
            columnStats[col.id] = null; // No stats for text columns
            continue;
        }
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

    // Build HTML table
    const table = document.createElement('table');
    table.className = 'heatmap-table';

    // Build thead with clickable headers
    const thead = buildTableHeader(visibleColumns);
    table.appendChild(thead);

    // Build tbody with colored cells
    const tbody = buildTableBody(riders, visibleColumns, columnStats);
    table.appendChild(tbody);

    // Replace container contents
    container.innerHTML = '';
    container.appendChild(table);

    // Build Team Heatmaps (Mean, Max, Min)
    const teamAggregates = aggregateTeamData(riders, visibleColumns);

    if (teamAggregates.length > 0) {
        // Define the team stats to render
        const teamStats = [
            { type: 'mean', label: 'Mean', title: 'Team Averages' },
            { type: 'max', label: 'Max', title: 'Team Maximums' },
            { type: 'min', label: 'Min', title: 'Team Minimums' }
        ];

        for (const stat of teamStats) {
            // Section divider
            const divider = document.createElement('div');
            divider.className = 'team-heatmap-divider';
            divider.innerHTML = `<span>${stat.title}</span>`;
            container.appendChild(divider);

            // Sort teams by this stat type
            const sortedTeams = sortTeams(teamAggregates, visibleColumns, stat.type);

            // Build team table
            const teamTable = document.createElement('table');
            teamTable.className = 'heatmap-table team-heatmap-table';

            // Build team thead
            const teamThead = buildTeamTableHeader(visibleColumns);
            teamTable.appendChild(teamThead);

            // Build team tbody - use SAME columnStats for consistent coloring
            const teamTbody = buildTeamTableBody(sortedTeams, visibleColumns, columnStats, stat.type, stat.label);
            teamTable.appendChild(teamTbody);

            container.appendChild(teamTable);
        }
    }

    // Setup tooltip handlers
    setupCellTooltips(container, visibleColumns, columnStats);
}

/**
 * Get the value to sort by for a rider and column
 */
function getSortValue(rider, col) {
    return rider.athleteData[col.dataKey];
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
        const valA = getSortValue(a, col);
        const valB = getSortValue(b, col);

        // Text columns: use string comparison
        if (col.format === 'text') {
            const strA = (valA || '').toString().toLowerCase();
            const strB = (valB || '').toString().toLowerCase();
            // Empty strings sort last
            if (!strA && strB) return currentSort.ascending ? 1 : -1;
            if (strA && !strB) return currentSort.ascending ? -1 : 1;
            if (!strA && !strB) return 0;

            if (currentSort.ascending) {
                return strA.localeCompare(strB);
            } else {
                return strB.localeCompare(strA);
            }
        }

        // Numeric columns: use numeric comparison
        const numA = valA ?? -Infinity;
        const numB = valB ?? -Infinity;

        if (currentSort.ascending) {
            return numA - numB;
        } else {
            return numB - numA;
        }
    });
}

/**
 * Aggregate rider data by team, calculating mean, max, and min values for numeric columns
 * @param {Array} riders - Array of rider objects with athleteData
 * @param {Array} visibleColumns - Array of column definitions
 * @returns {Array} Array of team aggregate objects with mean, max, min stats
 */
function aggregateTeamData(riders, visibleColumns) {
    // Group riders by team
    const teamGroups = {};

    for (const rider of riders) {
        const team = rider.athleteData?.team || null;
        if (!team) continue; // Skip riders without a team

        if (!teamGroups[team]) {
            teamGroups[team] = [];
        }
        teamGroups[team].push(rider);
    }

    // Calculate mean, max, min for each team
    const teamAggregates = [];

    for (const [teamName, teamRiders] of Object.entries(teamGroups)) {
        const meanData = {};
        const maxData = {};
        const minData = {};

        for (const col of visibleColumns) {
            if (col.format === 'text') continue; // Skip text columns

            const values = teamRiders
                .map(r => r.athleteData[col.dataKey])
                .filter(v => v !== undefined && v !== null && v > 0);

            if (values.length > 0) {
                const sum = values.reduce((a, b) => a + b, 0);
                meanData[col.dataKey] = sum / values.length;
                maxData[col.dataKey] = Math.max(...values);
                minData[col.dataKey] = Math.min(...values);
            } else {
                meanData[col.dataKey] = null;
                maxData[col.dataKey] = null;
                minData[col.dataKey] = null;
            }
        }

        teamAggregates.push({
            team: teamName,
            riderCount: teamRiders.length,
            mean: meanData,
            max: maxData,
            min: minData
        });
    }

    return teamAggregates;
}

/**
 * Sort teams by current team sort column
 * @param {Array} teams - Array of team aggregate objects
 * @param {Array} visibleColumns - Array of column definitions
 * @param {string} statType - Which stat to sort by: 'mean', 'max', or 'min'
 */
function sortTeams(teams, visibleColumns, statType = 'mean') {
    if (teamSort.column === 'team') {
        return [...teams].sort((a, b) => {
            const cmp = a.team.toLowerCase().localeCompare(b.team.toLowerCase());
            return teamSort.ascending ? cmp : -cmp;
        });
    }

    const col = visibleColumns.find(c => c.id === teamSort.column);
    if (!col) return teams;

    return [...teams].sort((a, b) => {
        const valA = a[statType]?.[col.dataKey] ?? -Infinity;
        const valB = b[statType]?.[col.dataKey] ?? -Infinity;

        if (teamSort.ascending) {
            return valA - valB;
        } else {
            return valB - valA;
        }
    });
}

/**
 * Handle team column header click for sorting
 */
function handleTeamColumnClick(columnId) {
    if (teamSort.column === columnId) {
        teamSort.ascending = !teamSort.ascending;
    } else {
        teamSort.column = columnId;
        teamSort.ascending = columnId === 'team'; // Ascending for team name, descending for metrics
    }
    renderHeatmap();
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

// ============================================================================
// Known Athletes Tab Functions
// ============================================================================

function setupAthleteSearch() {
    const searchInput = document.getElementById('athlete-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (ev) => {
        renderAthleteMaxList(ev.target.value);
    });
}

function renderAthleteMaxListWithCurrentSearch() {
    const searchInput = document.getElementById('athlete-search');
    const currentFilter = searchInput ? searchInput.value : '';
    renderAthleteMaxList(currentFilter);
}

function setupAddRiderButton() {
    const addBtn = document.getElementById('add-rider-btn');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
        const idInput = document.getElementById('new-rider-id');
        const maxhrInput = document.getElementById('new-rider-maxhr');
        const nameInput = document.getElementById('new-rider-name');

        const athleteId = parseInt(idInput.value);
        const maxHR = parseInt(maxhrInput.value);

        if (athleteId && maxHR && maxHR >= 100 && maxHR <= 250) {
            // Get existing data or create new entry
            const existingData = storedAthleteData[athleteId] || {};
            const existingUserEdited = existingData.userEdited || {};

            storedAthleteData[athleteId] = {
                ...existingData,
                maxHR: Math.round(maxHR),
                name: nameInput?.value || existingData.name || `Athlete ${athleteId}`,
                userEdited: {
                    ...existingUserEdited,
                    maxHR: true,
                    name: nameInput?.value ? true : existingUserEdited.name
                }
            };
            saveStoredAthleteData();
            renderAthleteMaxList();
            idInput.value = '';
            maxhrInput.value = '';
            if (nameInput) nameInput.value = '';
        }
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

    // Add header row
    const headerRow = document.createElement('div');
    headerRow.className = 'athlete-max-row athlete-max-header';
    headerRow.innerHTML = `
        <div class="athlete-info"><span class="header-label">Athlete</span></div>
        <span class="header-label team-header">Team</span>
        <span class="header-label hr-header">HR</span>
        <div class="power-inputs header-power">
            ${POWER_COLUMNS.map(col => `<span class="header-label">${col.label}</span>`).join('')}
        </div>
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
        nameSpan.className = 'athlete-name clickable-name';
        nameSpan.textContent = name;
        nameSpan.title = 'Click to view all data';
        nameSpan.onclick = () => showRiderModal(athleteId, name);
        infoDiv.appendChild(nameSpan);

        const metaSpan = document.createElement('span');
        metaSpan.className = 'athlete-meta';
        const metaParts = [];
        if (team) metaParts.push(team);
        metaParts.push(`ID: ${athleteId}`);
        metaSpan.textContent = metaParts.join(' · ');
        infoDiv.appendChild(metaSpan);

        // Team input
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

    // Profile Handicaps
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
        { key: 'race_current_mixed_number', label: 'Mixed Rank' }
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
