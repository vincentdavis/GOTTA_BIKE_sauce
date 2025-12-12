import * as common from '/pages/src/common.mjs';

// Storage keys (global, shared across windows)
const ATHLETE_DATA_KEY = '/gotta-bike-sauce-athlete-data';
const GOTTA_AUTH_KEY = '/gotta-bike-sauce-auth';
const GOTTA_API_URL = 'https://app.gotta.bike';

// Background color options
const BACKGROUND_OPTIONS = {
    transparent: { name: 'Transparent', color: null },
    black: { name: 'Black', color: '#000000' },
    sauce: { name: 'Sauce Default', color: '#232323' },
    darkGray: { name: 'Dark Gray', color: '#1a1a1a' },
    darkBlue: { name: 'Dark Blue', color: '#0d1b2a' },
    darkGreen: { name: 'Dark Green', color: '#1a2e1a' },
    custom: { name: 'Custom', color: null }
};

// State (session only - not persisted)
let homeTeam = null;
let awayTeam = null;
let storedAthleteData = {};
let currentSort = { column: 'wkg60', ascending: false };
let notRacingRiders = new Set(); // Set of rider IDs marked as not racing
let currentRouteProfile = null; // Selected route profile: flat, rolling, hilly, mountainous

// Chart instances for cleanup
let radarChartPowerWkg = null;
let radarChartPowerWatts = null;
let radarChartPhenotype = null;

// Route profile options
const ROUTE_PROFILES = [
    { id: '', label: 'No Route Selected' },
    { id: 'flat', label: 'Flat' },
    { id: 'rolling', label: 'Rolling' },
    { id: 'hilly', label: 'Hilly' },
    { id: 'mountainous', label: 'Mountainous' }
];

// All available columns for the comparison table
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
    { id: 'powerRating', label: 'Power Rating', category: 'power_model', dataKey: 'power_powerRating', format: 'decimal1' },

    // Physical
    { id: 'weight', label: 'Weight', category: 'physical', dataKey: 'weight', format: 'decimal1', suffix: 'kg' },

    // Profile Suitability (stored as 0-1, display as percentage)
    { id: 'profileFlat', label: 'Flat %', category: 'profile', dataKey: 'handicaps_profile_flat', format: 'percent' },
    { id: 'profileRolling', label: 'Rolling %', category: 'profile', dataKey: 'handicaps_profile_rolling', format: 'percent' },
    { id: 'profileHilly', label: 'Hilly %', category: 'profile', dataKey: 'handicaps_profile_hilly', format: 'percent' },
    { id: 'profileMountain', label: 'Mountain %', category: 'profile', dataKey: 'handicaps_profile_mountainous', format: 'percent' },

    // Race Ranking
    { id: 'raceRating', label: 'Rating', category: 'race_ranking', dataKey: 'race_current_rating', format: 'decimal1' },
    { id: 'raceRating30', label: 'Rating 30d', category: 'race_ranking', dataKey: 'race_max30_rating', format: 'decimal1' },
    { id: 'raceRating90', label: 'Rating 90d', category: 'race_ranking', dataKey: 'race_max90_rating', format: 'decimal1' },
    { id: 'adjustedRating', label: 'Adj Rating', category: 'race_ranking', dataKey: 'adjusted_rating', format: 'decimal1', calculated: true },
];

// Column categories for grouping in UI
const COLUMN_CATEGORIES = {
    power_watts: 'Power (Watts)',
    power_wkg: 'Power (W/kg)',
    power_model: 'Power Model',
    physical: 'Physical',
    profile: 'Profile Suitability',
    race_ranking: 'Race Ranking'
};

// Default selected columns
const DEFAULT_COLUMNS = ['wkg5', 'wkg15', 'wkg60', 'wkg300', 'w5', 'w15', 'w60', 'w300'];

// Default settings
common.settingsStore.setDefault({
    fontScale: 1,
    backgroundOption: 'transparent',
    customBackgroundColor: '#232323',
    selectedColumns: JSON.stringify(DEFAULT_COLUMNS),
    defaultSortColumn: 'wkg60',
    defaultSortAscending: 'false'
});

/**
 * Capture the content area and copy to clipboard as an image
 * Excludes elements with data-exclude-capture attribute
 */
async function captureAndShare() {
    const shareBtn = document.getElementById('share-btn');
    const content = document.getElementById('content');

    if (!content || !window.html2canvas) {
        console.error('Cannot capture: content not found or html2canvas not loaded');
        return;
    }

    // Show loading state
    const originalTitle = shareBtn?.getAttribute('title');
    if (shareBtn) {
        shareBtn.classList.add('sharing');
        shareBtn.setAttribute('title', 'Capturing...');
    }

    try {
        // Store original styles
        const originalStyles = {
            height: content.style.height,
            maxHeight: content.style.maxHeight,
            overflow: content.style.overflow,
            background: content.style.background
        };

        // Get background color
        const computedBg = getComputedStyle(document.body).getPropertyValue('--background-color') || '#000000';

        // Temporarily expand content to full height for capture
        content.style.height = 'auto';
        content.style.maxHeight = 'none';
        content.style.overflow = 'visible';
        content.style.background = computedBg;

        // Scroll to top to ensure consistent capture
        content.scrollTop = 0;

        // Wait for layout to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture the full content, excluding elements with data-exclude-capture
        const canvas = await html2canvas(content, {
            backgroundColor: computedBg,
            scale: 2, // Higher resolution
            logging: false,
            useCORS: true,
            allowTaint: true,
            windowHeight: content.scrollHeight,
            height: content.scrollHeight,
            ignoreElements: (element) => element.hasAttribute('data-exclude-capture')
        });

        // Restore original styles
        content.style.height = originalStyles.height;
        content.style.maxHeight = originalStyles.maxHeight;
        content.style.overflow = originalStyles.overflow;
        content.style.background = originalStyles.background;

        // Convert to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        // Try to copy to clipboard
        if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            showShareFeedback('Copied to clipboard!', 'success');
        } else {
            // Fallback: download the image
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `club-ladder-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
            showShareFeedback('Downloaded image', 'success');
        }
    } catch (err) {
        console.error('Share failed:', err);
        showShareFeedback('Share failed', 'error');
    } finally {
        // Restore button state
        if (shareBtn) {
            shareBtn.classList.remove('sharing');
            shareBtn.setAttribute('title', originalTitle || 'Copy image to clipboard');
        }
    }
}

/**
 * Show feedback message after share attempt
 */
function showShareFeedback(message, type) {
    // Remove existing feedback
    const existing = document.querySelector('.share-feedback');
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.className = `share-feedback share-feedback-${type}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    // Animate in
    requestAnimationFrame(() => {
        feedback.classList.add('visible');
    });

    // Remove after delay
    setTimeout(() => {
        feedback.classList.remove('visible');
        setTimeout(() => feedback.remove(), 300);
    }, 2000);
}

/**
 * Main entry point for Club Ladder window
 */
export async function clubLadderMain() {
    common.initInteractionListeners();

    // Setup share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', captureAndShare);
    }

    // Load stored athlete data (for cached GOTTA.BIKE data)
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
    setupTeamInputs();
    setupRouteSelector();
    setupImportButton();
    setupTooltip();
    setupRiderModal();

    // Listen for settings changes
    common.settingsStore.addEventListener('changed', ev => {
        const changed = ev.data.changed;
        if (changed.has('fontScale')) {
            document.documentElement.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
        }
        if (changed.has('backgroundOption') || changed.has('customBackgroundColor')) {
            applyBackground();
        }
        // Re-render table if columns changed
        if (homeTeam || awayTeam) {
            renderComparisonTable();
        }
    });

    // Listen for athlete data updates from other windows
    common.settingsStore.addEventListener('set', ev => {
        if (ev.data.key === ATHLETE_DATA_KEY) {
            loadStoredAthleteData();
            if (homeTeam || awayTeam) {
                renderComparisonTable();
            }
        }
    });

    // Show initial state
    updateUI();
}

/**
 * Settings entry point for Club Ladder settings window
 */
export async function clubLadderSettingsMain() {
    common.initInteractionListeners();

    // Setup tab navigation
    setupTabNavigation();

    // Initialize form bindings
    await common.initSettingsForm('form#display-options')();
    await common.initSettingsForm('form#sort-options')();

    // Setup custom color toggle
    setupCustomColorToggle();

    // Setup column picker
    setupColumnPicker();

    // Populate sort column select
    populateSortColumnSelect();
}

/**
 * Load stored athlete data from global storage
 */
function loadStoredAthleteData() {
    storedAthleteData = common.settingsStore.get(ATHLETE_DATA_KEY) || {};
}

/**
 * Save stored athlete data to global storage
 */
function saveStoredAthleteData() {
    common.settingsStore.set(ATHLETE_DATA_KEY, storedAthleteData);
}

/**
 * Apply background color based on settings
 */
function applyBackground() {
    const option = common.settingsStore.get('backgroundOption') || 'transparent';
    const customColor = common.settingsStore.get('customBackgroundColor') || '#232323';

    let bgColor = null;
    if (option === 'custom') {
        bgColor = customColor;
    } else if (BACKGROUND_OPTIONS[option]) {
        bgColor = BACKGROUND_OPTIONS[option].color;
    }

    if (bgColor) {
        document.body.classList.remove('transparent-bg');
        document.body.classList.add('solid-background');
        document.documentElement.style.setProperty('--background-color', bgColor);
    } else {
        document.body.classList.add('transparent-bg');
        document.body.classList.remove('solid-background');
    }
}

/**
 * Setup team input handlers
 */
function setupTeamInputs() {
    // Home team
    const loadHomeBtn = document.getElementById('load-home-btn');
    const clearHomeBtn = document.getElementById('clear-home-btn');
    const homeTextarea = document.getElementById('home-team-json');

    if (loadHomeBtn) {
        loadHomeBtn.addEventListener('click', () => {
            const jsonText = homeTextarea?.value || '';
            loadTeamJson(jsonText, 'home');
        });
    }

    if (clearHomeBtn) {
        clearHomeBtn.addEventListener('click', () => {
            // Clear notRacing state for home team riders
            if (homeTeam?.riders) {
                for (const r of homeTeam.riders) {
                    notRacingRiders.delete(r.rider_id);
                }
            }
            homeTeam = null;
            if (homeTextarea) homeTextarea.value = '';
            document.getElementById('home-team-info').hidden = true;
            updateUI();
        });
    }

    // Away team
    const loadAwayBtn = document.getElementById('load-away-btn');
    const clearAwayBtn = document.getElementById('clear-away-btn');
    const awayTextarea = document.getElementById('away-team-json');

    if (loadAwayBtn) {
        loadAwayBtn.addEventListener('click', () => {
            const jsonText = awayTextarea?.value || '';
            loadTeamJson(jsonText, 'away');
        });
    }

    if (clearAwayBtn) {
        clearAwayBtn.addEventListener('click', () => {
            // Clear notRacing state for away team riders
            if (awayTeam?.riders) {
                for (const r of awayTeam.riders) {
                    notRacingRiders.delete(r.rider_id);
                }
            }
            awayTeam = null;
            if (awayTextarea) awayTextarea.value = '';
            document.getElementById('away-team-info').hidden = true;
            updateUI();
        });
    }
}

/**
 * Setup route profile selector
 */
function setupRouteSelector() {
    const select = document.getElementById('route-profile-select');
    if (!select) return;

    // Populate options
    for (const profile of ROUTE_PROFILES) {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.label;
        select.appendChild(option);
    }

    // Handle change
    select.addEventListener('change', () => {
        currentRouteProfile = select.value || null;
        if (homeTeam || awayTeam) {
            renderComparisonTable();
        }
    });
}

/**
 * Calculate adjusted rating based on route profile
 * Formula: race_current_rating + profile_suitability
 */
function calculateAdjustedRating(athleteData) {
    if (!athleteData || !currentRouteProfile) return null;

    const baseRating = athleteData.race_current_rating;
    if (baseRating === undefined || baseRating === null) return null;

    // Map route profile to athlete's profile suitability field
    const profileMap = {
        'flat': 'handicaps_profile_flat',
        'rolling': 'handicaps_profile_rolling',
        'hilly': 'handicaps_profile_hilly',
        'mountainous': 'handicaps_profile_mountainous'
    };

    const profileKey = profileMap[currentRouteProfile];
    if (!profileKey) return baseRating;

    const profileSuitability = athleteData[profileKey];
    if (profileSuitability === undefined || profileSuitability === null) return baseRating;

    return baseRating + profileSuitability;
}

/**
 * Parse and load team JSON
 */
function loadTeamJson(jsonText, teamType) {
    try {
        const data = JSON.parse(jsonText);

        if (!data.team) {
            throw new Error('Invalid JSON: missing "team" object');
        }

        const team = data.team;
        if (!team.name || !team.riders || !Array.isArray(team.riders)) {
            throw new Error('Invalid JSON: team must have "name" and "riders" array');
        }

        // Store the team
        if (teamType === 'home') {
            homeTeam = team;
            updateTeamInfo('home', team);
        } else {
            awayTeam = team;
            updateTeamInfo('away', team);
        }

        hideError();
        updateUI();
    } catch (err) {
        showError(`Failed to parse ${teamType} team JSON: ${err.message}`);
    }
}

/**
 * Update team info display
 */
function updateTeamInfo(teamType, team) {
    const infoDiv = document.getElementById(`${teamType}-team-info`);
    const nameEl = document.getElementById(`${teamType}-team-name`);
    const captainEl = document.getElementById(`${teamType}-team-captain`);
    const rankEl = document.getElementById(`${teamType}-team-rank`);
    const ridersEl = document.getElementById(`${teamType}-team-riders`);

    if (infoDiv) infoDiv.hidden = false;
    if (nameEl) nameEl.textContent = team.name;
    if (captainEl) captainEl.textContent = team.captain ? `Captain: ${team.captain}` : '';

    if (rankEl && team.ranks && team.ranks.length > 0) {
        const rank = team.ranks[0];
        rankEl.innerHTML = `<span class="team-rank ${rank.division}">${rank.division} #${rank.position}</span>`;
    } else if (rankEl) {
        rankEl.innerHTML = '';
    }

    if (ridersEl) ridersEl.textContent = `${team.riders.length} riders`;
}

/**
 * Update UI state
 */
function updateUI() {
    const importSection = document.getElementById('import-section');
    const noData = document.getElementById('no-data');
    const tableWrapper = document.getElementById('comparison-table-wrapper');

    const hasTeams = homeTeam || awayTeam;

    if (importSection) importSection.hidden = !hasTeams;
    if (noData) noData.hidden = hasTeams;

    if (hasTeams) {
        renderComparisonTable();
    } else if (tableWrapper) {
        tableWrapper.innerHTML = '';
    }
}

/**
 * Setup import button
 */
function setupImportButton() {
    const importBtn = document.getElementById('import-btn');
    const importStatus = document.getElementById('import-status');

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            // Collect all rider IDs from both teams
            const riderIds = [];
            if (homeTeam?.riders) {
                riderIds.push(...homeTeam.riders.map(r => r.rider_id));
            }
            if (awayTeam?.riders) {
                riderIds.push(...awayTeam.riders.map(r => r.rider_id));
            }

            if (riderIds.length === 0) {
                if (importStatus) {
                    importStatus.textContent = 'No riders to import';
                    importStatus.className = 'error';
                }
                return;
            }

            // Disable button during import
            importBtn.disabled = true;
            if (importStatus) {
                importStatus.textContent = 'Importing...';
                importStatus.className = '';
            }

            showLoading(true);

            try {
                const results = await bulkImportFromGotta(riderIds, (current, total) => {
                    if (importStatus) {
                        importStatus.textContent = `Importing ${current}/${total}...`;
                    }
                });

                if (importStatus) {
                    importStatus.textContent = `Imported ${results.success} riders`;
                    importStatus.className = 'success';
                }

                renderComparisonTable();
            } catch (err) {
                console.error('[ClubLadder] Import error:', err);
                if (importStatus) {
                    importStatus.textContent = err.message;
                    importStatus.className = 'error';
                }
            } finally {
                importBtn.disabled = false;
                showLoading(false);
            }
        });
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
            console.error('[ClubLadder] Batch import error:', err);
            throw err;
        }
    }

    saveStoredAthleteData();
    return results;
}

/**
 * Import athlete data from API response
 */
function importAthleteData(riderData) {
    if (!riderData || !riderData.riderId) return;

    const athleteId = riderData.riderId;
    const existingData = storedAthleteData[athleteId] || {};
    const existingUserEdited = existingData.userEdited || {};

    let team = existingUserEdited.team ? existingData.team :
        (riderData.team || extractTeamFromName(riderData.name) || existingData.team || null);

    let name = existingUserEdited.name ? existingData.name :
        (riderData.name || existingData.name || null);

    storedAthleteData[athleteId] = {
        ...riderData,
        name: name,
        team: team,
        maxHR: existingData.maxHR,
        userEdited: existingUserEdited,
        lastUpdated: Date.now()
    };
}

/**
 * Extract team name from rider name
 */
function extractTeamFromName(name) {
    if (!name) return null;

    const bracketMatch = name.match(/\[([^\]]+)\]/);
    if (bracketMatch) return bracketMatch[1].trim();

    const parenMatch = name.match(/\(([^)]+)\)/);
    if (parenMatch) return parenMatch[1].trim();

    return null;
}

/**
 * Show/hide loading spinner
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) loading.hidden = !show;
}

/**
 * Show error message
 */
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
    }
}

/**
 * Hide error message
 */
function hideError() {
    const errorEl = document.getElementById('error');
    if (errorEl) errorEl.hidden = true;
}

/**
 * Get selected columns from settings
 */
function getSelectedColumns() {
    try {
        const stored = common.settingsStore.get('selectedColumns');
        const columnIds = JSON.parse(stored || '[]');
        return columnIds.map(id => AVAILABLE_COLUMNS.find(c => c.id === id)).filter(Boolean);
    } catch {
        return DEFAULT_COLUMNS.map(id => AVAILABLE_COLUMNS.find(c => c.id === id)).filter(Boolean);
    }
}

/**
 * Render the comparison table
 */
function renderComparisonTable() {
    const wrapper = document.getElementById('comparison-table-wrapper');
    if (!wrapper) return;

    const visibleColumns = getSelectedColumns();
    if (visibleColumns.length === 0) {
        wrapper.innerHTML = '<div class="no-data"><p>No columns selected. Configure columns in Settings.</p></div>';
        // Hide radar charts when no columns
        const chartContainer = document.getElementById('radar-chart-container');
        if (chartContainer) chartContainer.hidden = true;
        return;
    }

    // Build rider data from both teams
    let allRiders = [];

    if (homeTeam?.riders) {
        for (const r of homeTeam.riders) {
            const athleteData = storedAthleteData[r.rider_id];
            // Calculate adjusted rating based on route profile
            const adjustedRating = athleteData ? calculateAdjustedRating(athleteData) : null;
            allRiders.push({
                id: r.rider_id,
                name: r.name,
                profile: r.profile,
                team: 'home',
                teamName: homeTeam.name,
                athleteData: athleteData ? { ...athleteData, adjusted_rating: adjustedRating } : null
            });
        }
    }

    if (awayTeam?.riders) {
        for (const r of awayTeam.riders) {
            const athleteData = storedAthleteData[r.rider_id];
            // Calculate adjusted rating based on route profile
            const adjustedRating = athleteData ? calculateAdjustedRating(athleteData) : null;
            allRiders.push({
                id: r.rider_id,
                name: r.name,
                profile: r.profile,
                team: 'away',
                teamName: awayTeam.name,
                athleteData: athleteData ? { ...athleteData, adjusted_rating: adjustedRating } : null
            });
        }
    }

    if (allRiders.length === 0) {
        wrapper.innerHTML = '<div class="no-data"><p>No riders loaded.</p></div>';
        // Hide radar charts when no data
        const chartContainer = document.getElementById('radar-chart-container');
        if (chartContainer) chartContainer.hidden = true;
        return;
    }

    // Split into racing and not racing
    const racingRiders = allRiders.filter(r => !notRacingRiders.has(r.id));
    const notRacingRidersList = allRiders.filter(r => notRacingRiders.has(r.id));

    // Sort both lists
    const sortedRacing = sortRiders(racingRiders, visibleColumns);
    const sortedNotRacing = sortRiders(notRacingRidersList, visibleColumns);

    // Calculate column statistics for color scaling (based on racing riders only)
    const columnStats = calculateColumnStats(sortedRacing, visibleColumns);

    wrapper.innerHTML = '';

    // Racing table
    if (sortedRacing.length > 0) {
        const racingSection = document.createElement('div');
        racingSection.className = 'table-section racing-section';

        const table = document.createElement('table');
        table.className = 'comparison-table';

        const thead = buildTableHeader(visibleColumns, true);
        table.appendChild(thead);

        const tbody = buildTableBody(sortedRacing, visibleColumns, columnStats, true);
        table.appendChild(tbody);

        racingSection.appendChild(table);
        wrapper.appendChild(racingSection);
    }

    // Not Racing table
    if (sortedNotRacing.length > 0) {
        const notRacingSection = document.createElement('div');
        notRacingSection.className = 'table-section not-racing-section';

        const divider = document.createElement('div');
        divider.className = 'not-racing-divider';
        divider.innerHTML = `<span>Not Racing (${sortedNotRacing.length})</span>`;
        notRacingSection.appendChild(divider);

        const table = document.createElement('table');
        table.className = 'comparison-table not-racing-table';

        const thead = buildTableHeader(visibleColumns, false);
        table.appendChild(thead);

        const tbody = buildTableBody(sortedNotRacing, visibleColumns, columnStats, false);
        table.appendChild(tbody);

        notRacingSection.appendChild(table);
        wrapper.appendChild(notRacingSection);
    }

    // Setup cell tooltips for both tables
    setupCellTooltips(wrapper, visibleColumns, columnStats);

    // Render radar charts based on racing riders only
    const teamAggregates = calculateTeamAggregates(sortedRacing);
    renderTeamRadarCharts(teamAggregates);
}

/**
 * Sort riders based on current sort settings
 */
function sortRiders(riders, visibleColumns) {
    const sortCol = AVAILABLE_COLUMNS.find(c => c.id === currentSort.column);

    return [...riders].sort((a, b) => {
        // First sort by team if sorting by team
        if (currentSort.column === 'team') {
            const teamCompare = a.team.localeCompare(b.team);
            return currentSort.ascending ? teamCompare : -teamCompare;
        }

        // For metric columns
        if (sortCol) {
            const aVal = a.athleteData ? getColumnValue(a.athleteData, sortCol) : null;
            const bVal = b.athleteData ? getColumnValue(b.athleteData, sortCol) : null;

            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return 1;
            if (bVal === null) return -1;

            const diff = aVal - bVal;
            return currentSort.ascending ? diff : -diff;
        }

        return 0;
    });
}

/**
 * Get column value from athlete data
 */
function getColumnValue(athleteData, col) {
    if (!athleteData) return null;
    const value = athleteData[col.dataKey];
    return (value !== undefined && value !== null && value > 0) ? value : null;
}

/**
 * Calculate min/median/max for each column
 */
function calculateColumnStats(riders, visibleColumns) {
    const stats = {};

    for (const col of visibleColumns) {
        if (col.format === 'text') continue;

        const values = riders
            .map(r => r.athleteData ? getColumnValue(r.athleteData, col) : null)
            .filter(v => v !== null && v > 0)
            .sort((a, b) => a - b);

        if (values.length > 0) {
            stats[col.id] = {
                min: values[0],
                max: values[values.length - 1],
                median: values[Math.floor(values.length / 2)]
            };
        }
    }

    return stats;
}

/**
 * Build table header
 */
function buildTableHeader(visibleColumns, isRacingTable = true) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');

    // Racing toggle column
    const racingTh = document.createElement('th');
    racingTh.className = 'racing-col';
    racingTh.title = isRacingTable ? 'Click checkbox to mark as Not Racing' : 'Click checkbox to mark as Racing';
    racingTh.textContent = '';
    tr.appendChild(racingTh);

    // Team column
    const teamTh = document.createElement('th');
    teamTh.className = 'team-col sortable';
    teamTh.textContent = 'Team';
    teamTh.dataset.colId = 'team';
    if (currentSort.column === 'team') {
        teamTh.classList.add('sorted');
        teamTh.textContent += currentSort.ascending ? ' \u25b2' : ' \u25bc';
    }
    teamTh.addEventListener('click', () => handleHeaderClick('team'));
    tr.appendChild(teamTh);

    // Name column
    const nameTh = document.createElement('th');
    nameTh.className = 'rider-col';
    nameTh.textContent = 'Name';
    tr.appendChild(nameTh);

    // Metric columns
    for (const col of visibleColumns) {
        const th = document.createElement('th');
        th.className = 'sortable';
        th.textContent = col.label;
        th.dataset.colId = col.id;
        if (currentSort.column === col.id) {
            th.classList.add('sorted');
            th.textContent += currentSort.ascending ? ' \u25b2' : ' \u25bc';
        }
        th.addEventListener('click', () => handleHeaderClick(col.id));
        tr.appendChild(th);
    }

    thead.appendChild(tr);
    return thead;
}

/**
 * Handle header click for sorting
 */
function handleHeaderClick(colId) {
    if (currentSort.column === colId) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.column = colId;
        currentSort.ascending = false;
    }
    renderComparisonTable();
}

/**
 * Build table body
 */
function buildTableBody(riders, visibleColumns, columnStats, isRacingTable = true) {
    const tbody = document.createElement('tbody');

    for (const rider of riders) {
        const tr = document.createElement('tr');

        // Racing toggle cell
        const racingTd = document.createElement('td');
        racingTd.className = 'racing-cell';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'racing-checkbox';
        checkbox.checked = isRacingTable; // Checked = racing, unchecked = not racing
        checkbox.title = isRacingTable ? 'Uncheck to mark as Not Racing' : 'Check to mark as Racing';
        checkbox.addEventListener('change', () => {
            toggleRiderRacing(rider.id, checkbox.checked);
        });
        racingTd.appendChild(checkbox);
        tr.appendChild(racingTd);

        // Team cell
        const teamTd = document.createElement('td');
        teamTd.className = `team-cell ${rider.team}`;
        teamTd.textContent = rider.team === 'home' ? 'HOME' : 'AWAY';
        tr.appendChild(teamTd);

        // Name cell
        const nameTd = document.createElement('td');
        nameTd.className = 'rider-name clickable';
        nameTd.textContent = rider.name;
        nameTd.dataset.riderId = rider.id;
        nameTd.dataset.profile = rider.profile || '';
        nameTd.addEventListener('click', () => showRiderModal(rider));
        tr.appendChild(nameTd);

        // Metric cells
        for (const col of visibleColumns) {
            const td = document.createElement('td');
            td.className = 'metric-cell';

            const value = rider.athleteData ? getColumnValue(rider.athleteData, col) : null;
            const stats = columnStats[col.id];
            const normalizedValue = normalizeValue(value, stats);
            const colorTier = getColorTier(normalizedValue);

            td.classList.add(`color-tier-${colorTier}`);
            td.textContent = value !== null && value > 0 ? formatColumnValue(value, col) : '';

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
 * Toggle rider racing status
 */
function toggleRiderRacing(riderId, isRacing) {
    if (isRacing) {
        notRacingRiders.delete(riderId);
    } else {
        notRacingRiders.add(riderId);
    }
    renderComparisonTable();
}

/**
 * Format column value for display
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
 */
function getColorTier(normalizedValue) {
    if (normalizedValue === null || normalizedValue === undefined) return 0;
    if (normalizedValue < 0) return 0;
    if (normalizedValue < 10) return 1;
    if (normalizedValue < 25) return 2;
    if (normalizedValue < 40) return 3;
    if (normalizedValue < 60) return 4;
    if (normalizedValue < 75) return 5;
    if (normalizedValue < 90) return 6;
    return 7;
}

/**
 * Normalize a value to 0-100 scale based on column stats
 */
function normalizeValue(value, stats) {
    if (value === null || value === undefined || value <= 0) return null;
    if (!stats) return null;

    if (value <= stats.median) {
        if (stats.median > stats.min) {
            return ((value - stats.min) / (stats.median - stats.min)) * 50;
        } else {
            return 50;
        }
    } else {
        if (stats.max > stats.median) {
            return 50 + ((value - stats.median) / (stats.max - stats.median)) * 50;
        } else {
            return 50;
        }
    }
}

/**
 * Setup tooltip handlers
 */
function setupTooltip() {
    // Tooltip is handled in setupCellTooltips
}

/**
 * Setup cell tooltips
 */
function setupCellTooltips(container, visibleColumns, columnStats) {
    const tooltip = document.getElementById('comparison-tooltip');
    if (!tooltip) return;

    const cells = container.querySelectorAll('.metric-cell');

    cells.forEach(cell => {
        cell.addEventListener('mouseenter', e => {
            const colId = cell.dataset.colId;
            const col = visibleColumns.find(c => c.id === colId);
            const rawValue = parseFloat(cell.dataset.rawValue);
            const riderName = cell.dataset.riderName;
            const stats = columnStats[colId];

            tooltip.querySelector('.tooltip-rider').textContent = riderName;
            tooltip.querySelector('.tooltip-metric').textContent =
                `${cell.dataset.colLabel}: ${isNaN(rawValue) ? '-' : formatColumnValue(rawValue, col)}${cell.dataset.colSuffix}`;

            if (stats) {
                tooltip.querySelector('.tooltip-stats').textContent =
                    `Min: ${formatColumnValue(stats.min, col)} | Med: ${formatColumnValue(stats.median, col)} | Max: ${formatColumnValue(stats.max, col)}`;
            } else {
                tooltip.querySelector('.tooltip-stats').textContent = '';
            }

            tooltip.hidden = false;
            positionTooltip(tooltip, e);
        });

        cell.addEventListener('mousemove', e => {
            positionTooltip(tooltip, e);
        });

        cell.addEventListener('mouseleave', () => {
            tooltip.hidden = true;
        });
    });
}

/**
 * Position tooltip near cursor
 */
function positionTooltip(tooltip, e) {
    const padding = 10;
    let x = e.clientX + padding;
    let y = e.clientY + padding;

    const tooltipRect = tooltip.getBoundingClientRect();
    if (x + tooltipRect.width > window.innerWidth) {
        x = e.clientX - tooltipRect.width - padding;
    }
    if (y + tooltipRect.height > window.innerHeight) {
        y = e.clientY - tooltipRect.height - padding;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

/**
 * Setup rider modal
 */
function setupRiderModal() {
    const modal = document.getElementById('rider-modal');
    const closeBtn = modal?.querySelector('.rider-modal-close');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.hidden = true;
        });
    }

    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                modal.hidden = true;
            }
        });
    }
}

/**
 * Show rider details modal
 */
function showRiderModal(rider) {
    const modal = document.getElementById('rider-modal');
    const title = modal?.querySelector('.rider-modal-title');
    const body = modal?.querySelector('.rider-modal-body');

    if (!modal || !body) return;

    if (title) title.textContent = rider.name;

    const athleteData = rider.athleteData;
    const riderId = rider.id;

    let html = `
        <div class="rider-profile-links">
            <a href="#" data-url="https://zwiftpower.com/profile.php?z=${riderId}">ZwiftPower</a>
            <a href="#" data-url="https://www.zwiftracing.app/riders/${riderId}">ZwiftRacing</a>
            <a href="#" data-url="https://gotta.bike/rider/${riderId}">GOTTA.BIKE</a>
        </div>
    `;

    if (athleteData) {
        html += '<div class="athlete-details-content">';

        // Power section
        html += `
            <div class="details-section">
                <div class="details-section-title">Power (W/kg)</div>
                <div class="details-grid">
                    ${formatDetailItem('5s', athleteData.power_wkg5, 'wkg')}
                    ${formatDetailItem('15s', athleteData.power_wkg15, 'wkg')}
                    ${formatDetailItem('1m', athleteData.power_wkg60, 'wkg')}
                    ${formatDetailItem('5m', athleteData.power_wkg300, 'wkg')}
                    ${formatDetailItem('20m', athleteData.power_wkg1200, 'wkg')}
                </div>
            </div>
        `;

        // Power watts section
        html += `
            <div class="details-section">
                <div class="details-section-title">Power (Watts)</div>
                <div class="details-grid">
                    ${formatDetailItem('5s', athleteData.power_w5, 'W')}
                    ${formatDetailItem('15s', athleteData.power_w15, 'W')}
                    ${formatDetailItem('1m', athleteData.power_w60, 'W')}
                    ${formatDetailItem('5m', athleteData.power_w300, 'W')}
                    ${formatDetailItem('20m', athleteData.power_w1200, 'W')}
                </div>
            </div>
        `;

        // Profile suitability section
        html += `
            <div class="details-section">
                <div class="details-section-title">Profile Suitability</div>
                <div class="details-grid">
                    ${formatDetailItem('Flat', athleteData.handicaps_profile_flat, '')}
                    ${formatDetailItem('Rolling', athleteData.handicaps_profile_rolling, '')}
                    ${formatDetailItem('Hilly', athleteData.handicaps_profile_hilly, '')}
                    ${formatDetailItem('Mountain', athleteData.handicaps_profile_mountainous, '')}
                </div>
            </div>
        `;

        // Race stats section
        const adjustedRating = calculateAdjustedRating(athleteData);
        html += `
            <div class="details-section">
                <div class="details-section-title">Race Stats</div>
                <div class="details-grid">
                    ${formatDetailItem('Rating', athleteData.race_current_rating, '')}
                    ${adjustedRating !== null ? formatDetailItem('Adj Rating', adjustedRating, '') : ''}
                    ${formatDetailItem('30d Max', athleteData.race_max30_rating, '')}
                    ${formatDetailItem('Finishes', athleteData.race_finishes, '')}
                    ${formatDetailItem('Wins', athleteData.race_wins, '')}
                    ${formatDetailItem('Podiums', athleteData.race_podiums, '')}
                </div>
            </div>
        `;

        html += '</div>';
    } else {
        html += '<div class="no-gotta-data">No GOTTA.BIKE data available. Click "Import GOTTA.BIKE Data" to fetch power profiles.</div>';
    }

    body.innerHTML = html;

    // Setup profile link handlers
    body.querySelectorAll('.rider-profile-links a').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const url = link.dataset.url;
            if (url && common.rpc?.openExternalLink) {
                common.rpc.openExternalLink(url);
            } else if (url) {
                window.open(url, '_blank');
            }
        });
    });

    modal.hidden = false;
}

/**
 * Format a detail item for the modal
 */
function formatDetailItem(label, value, suffix) {
    const displayValue = value !== undefined && value !== null && value > 0
        ? (typeof value === 'number' ? value.toFixed(1) : value) + (suffix ? ` ${suffix}` : '')
        : '-';
    return `
        <div class="details-item">
            <span class="details-label">${label}:</span>
            <span class="details-value">${displayValue}</span>
        </div>
    `;
}

// ============== Radar Chart Functions ==============

/**
 * Generate a consistent color for a team name
 */
function getTeamColor(teamName, alpha = 1) {
    let hash = 0;
    for (let i = 0; i < teamName.length; i++) {
        hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsla(${h}, 70%, 50%, ${alpha})`;
}

/**
 * Calculate team aggregates (mean, max, min) for radar charts
 */
function calculateTeamAggregates(racingRiders) {
    // Group riders by team (home vs away)
    const teams = {
        home: { name: homeTeam?.name || 'Home Team', riders: [] },
        away: { name: awayTeam?.name || 'Away Team', riders: [] }
    };

    for (const rider of racingRiders) {
        if (rider.athleteData) {
            teams[rider.team].riders.push(rider);
        }
    }

    // Data keys to aggregate
    const dataKeys = [
        'power_wkg5', 'power_wkg15', 'power_wkg30', 'power_wkg60', 'power_wkg120', 'power_wkg300', 'power_wkg1200',
        'power_w5', 'power_w15', 'power_w30', 'power_w60', 'power_w120', 'power_w300', 'power_w1200',
        'phenotype_scores_sprinter', 'phenotype_scores_puncheur', 'phenotype_scores_pursuiter',
        'phenotype_scores_tt', 'phenotype_scores_climber'
    ];

    const teamAggregates = [];

    for (const [teamKey, teamData] of Object.entries(teams)) {
        if (teamData.riders.length === 0) continue;

        const meanData = {};
        const maxData = {};
        const minData = {};

        for (const dataKey of dataKeys) {
            const values = teamData.riders
                .map(r => r.athleteData[dataKey])
                .filter(v => v !== undefined && v !== null && v > 0);

            if (values.length > 0) {
                const sum = values.reduce((a, b) => a + b, 0);
                meanData[dataKey] = sum / values.length;
                maxData[dataKey] = Math.max(...values);
                minData[dataKey] = Math.min(...values);
            } else {
                meanData[dataKey] = null;
                maxData[dataKey] = null;
                minData[dataKey] = null;
            }
        }

        teamAggregates.push({
            team: teamData.name,
            teamKey: teamKey,
            riderCount: teamData.riders.length,
            mean: meanData,
            max: maxData,
            min: minData
        });
    }

    return teamAggregates;
}

/**
 * Render radar charts for team comparison
 */
function renderTeamRadarCharts(teamAggregates) {
    const container = document.getElementById('radar-chart-container');
    if (!container || !window.Chart) {
        console.warn('Chart.js not loaded or container not found');
        return;
    }

    // Show container if we have teams with data
    if (teamAggregates.length === 0) {
        container.hidden = true;
        return;
    }
    container.hidden = false;

    // Destroy existing charts
    if (radarChartPowerWkg) {
        radarChartPowerWkg.destroy();
        radarChartPowerWkg = null;
    }
    if (radarChartPowerWatts) {
        radarChartPowerWatts.destroy();
        radarChartPowerWatts = null;
    }
    if (radarChartPhenotype) {
        radarChartPhenotype.destroy();
        radarChartPhenotype = null;
    }

    // Power radar chart - W/kg at different durations
    const powerLabels = ['5s', '15s', '30s', '1m', '2m', '5m', '20m'];
    const powerWkgKeys = ['power_wkg5', 'power_wkg15', 'power_wkg30', 'power_wkg60', 'power_wkg120', 'power_wkg300', 'power_wkg1200'];

    const powerWkgDatasets = teamAggregates.map(team => ({
        label: team.team,
        data: powerWkgKeys.map(key => team.mean[key] || 0),
        backgroundColor: getTeamColor(team.team, 0.2),
        borderColor: getTeamColor(team.team, 1),
        borderWidth: 2,
        pointBackgroundColor: getTeamColor(team.team, 1),
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: getTeamColor(team.team, 1)
    }));

    const powerWkgCtx = document.getElementById('radar-chart-power-wkg');
    if (powerWkgCtx) {
        radarChartPowerWkg = new Chart(powerWkgCtx, {
            type: 'radar',
            data: {
                labels: powerLabels,
                datasets: powerWkgDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Power Profile (W/kg)',
                        color: '#fff',
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ccc',
                            font: { size: 10 },
                            boxWidth: 12
                        }
                    }
                },
                scales: {
                    r: {
                        angleLines: { color: '#444' },
                        grid: { color: '#444' },
                        pointLabels: { color: '#ccc', font: { size: 11 } },
                        ticks: {
                            color: '#888',
                            backdropColor: 'transparent',
                            font: { size: 9 }
                        },
                        suggestedMin: 0
                    }
                }
            }
        });
    }

    // Power radar chart - Watts at different durations
    const powerWattsKeys = ['power_w5', 'power_w15', 'power_w30', 'power_w60', 'power_w120', 'power_w300', 'power_w1200'];

    const powerWattsDatasets = teamAggregates.map(team => ({
        label: team.team,
        data: powerWattsKeys.map(key => team.mean[key] || 0),
        backgroundColor: getTeamColor(team.team, 0.2),
        borderColor: getTeamColor(team.team, 1),
        borderWidth: 2,
        pointBackgroundColor: getTeamColor(team.team, 1),
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: getTeamColor(team.team, 1)
    }));

    const powerWattsCtx = document.getElementById('radar-chart-power-watts');
    if (powerWattsCtx) {
        radarChartPowerWatts = new Chart(powerWattsCtx, {
            type: 'radar',
            data: {
                labels: powerLabels,
                datasets: powerWattsDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Power Profile (Watts)',
                        color: '#fff',
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ccc',
                            font: { size: 10 },
                            boxWidth: 12
                        }
                    }
                },
                scales: {
                    r: {
                        angleLines: { color: '#444' },
                        grid: { color: '#444' },
                        pointLabels: { color: '#ccc', font: { size: 11 } },
                        ticks: {
                            color: '#888',
                            backdropColor: 'transparent',
                            font: { size: 9 }
                        },
                        suggestedMin: 0
                    }
                }
            }
        });
    }

    // Phenotype radar chart
    const phenoLabels = ['Sprinter', 'Puncheur', 'Pursuiter', 'TT', 'Climber'];
    const phenoKeys = [
        'phenotype_scores_sprinter',
        'phenotype_scores_puncheur',
        'phenotype_scores_pursuiter',
        'phenotype_scores_tt',
        'phenotype_scores_climber'
    ];

    const phenoDatasets = teamAggregates.map(team => ({
        label: team.team,
        data: phenoKeys.map(key => team.mean[key] || 0),
        backgroundColor: getTeamColor(team.team, 0.2),
        borderColor: getTeamColor(team.team, 1),
        borderWidth: 2,
        pointBackgroundColor: getTeamColor(team.team, 1),
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: getTeamColor(team.team, 1)
    }));

    const phenoCtx = document.getElementById('radar-chart-phenotype');
    if (phenoCtx) {
        radarChartPhenotype = new Chart(phenoCtx, {
            type: 'radar',
            data: {
                labels: phenoLabels,
                datasets: phenoDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Phenotype Profile',
                        color: '#fff',
                        font: { size: 14, weight: 'bold' }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#ccc',
                            font: { size: 10 },
                            boxWidth: 12
                        }
                    }
                },
                scales: {
                    r: {
                        angleLines: { color: '#444' },
                        grid: { color: '#444' },
                        pointLabels: { color: '#ccc', font: { size: 11 } },
                        ticks: {
                            color: '#888',
                            backdropColor: 'transparent',
                            font: { size: 9 }
                        },
                        suggestedMin: 0
                    }
                }
            }
        });
    }
}

// ============== Settings Page Functions ==============

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanels.forEach(panel => {
                panel.classList.toggle('active', panel.id === targetTab);
            });
        });
    });
}

/**
 * Setup custom color toggle based on background option
 */
function setupCustomColorToggle() {
    const select = document.querySelector('select[name="backgroundOption"]');
    const customRow = document.querySelector('.custom-color-row');

    if (!select || !customRow) return;

    const updateVisibility = () => {
        customRow.style.display = select.value === 'custom' ? 'flex' : 'none';
    };

    select.addEventListener('change', updateVisibility);
    updateVisibility();
}

/**
 * Setup column picker UI
 */
function setupColumnPicker() {
    const availableContainer = document.getElementById('available-columns');
    const selectedContainer = document.getElementById('selected-columns');
    const categoryFilter = document.getElementById('available-category');
    const addBtn = document.getElementById('add-column-btn');
    const removeBtn = document.getElementById('remove-column-btn');
    const moveUpBtn = document.getElementById('move-up-btn');
    const moveDownBtn = document.getElementById('move-down-btn');
    const resetBtn = document.getElementById('reset-columns-btn');

    if (!availableContainer || !selectedContainer) return;

    // Populate category filter
    if (categoryFilter) {
        for (const [key, label] of Object.entries(COLUMN_CATEGORIES)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = label;
            categoryFilter.appendChild(option);
        }

        categoryFilter.addEventListener('change', () => renderColumnPicker());
    }

    // Render initial state
    renderColumnPicker();

    // Button handlers
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const selected = availableContainer.querySelector('.column-item.selected');
            if (selected) {
                addColumn(selected.dataset.colId);
            }
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            const selected = selectedContainer.querySelector('.column-item.selected');
            if (selected) {
                removeColumn(selected.dataset.colId);
            }
        });
    }

    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', () => {
            const selected = selectedContainer.querySelector('.column-item.selected');
            if (selected) {
                moveColumn(selected.dataset.colId, -1);
            }
        });
    }

    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', () => {
            const selected = selectedContainer.querySelector('.column-item.selected');
            if (selected) {
                moveColumn(selected.dataset.colId, 1);
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            common.settingsStore.set('selectedColumns', JSON.stringify(DEFAULT_COLUMNS));
            renderColumnPicker();
            populateSortColumnSelect();
        });
    }

    function renderColumnPicker() {
        const selectedIds = getSelectedColumnIds();
        const categoryValue = categoryFilter?.value || '';

        // Available columns
        availableContainer.innerHTML = '';
        for (const col of AVAILABLE_COLUMNS) {
            if (selectedIds.includes(col.id)) continue;
            if (categoryValue && col.category !== categoryValue) continue;

            const item = document.createElement('div');
            item.className = 'column-item';
            item.dataset.colId = col.id;
            item.innerHTML = `${col.label} <span class="column-category">${COLUMN_CATEGORIES[col.category]}</span>`;
            item.addEventListener('click', () => {
                availableContainer.querySelectorAll('.column-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
            item.addEventListener('dblclick', () => addColumn(col.id));
            availableContainer.appendChild(item);
        }

        // Selected columns
        selectedContainer.innerHTML = '';
        for (const colId of selectedIds) {
            const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
            if (!col) continue;

            const item = document.createElement('div');
            item.className = 'column-item';
            item.dataset.colId = col.id;
            item.innerHTML = `${col.label} <span class="column-category">${COLUMN_CATEGORIES[col.category]}</span>`;
            item.addEventListener('click', () => {
                selectedContainer.querySelectorAll('.column-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
            item.addEventListener('dblclick', () => removeColumn(col.id));
            selectedContainer.appendChild(item);
        }
    }

    function getSelectedColumnIds() {
        try {
            return JSON.parse(common.settingsStore.get('selectedColumns') || '[]');
        } catch {
            return [...DEFAULT_COLUMNS];
        }
    }

    function addColumn(colId) {
        const selected = getSelectedColumnIds();
        if (!selected.includes(colId)) {
            selected.push(colId);
            common.settingsStore.set('selectedColumns', JSON.stringify(selected));
            renderColumnPicker();
            populateSortColumnSelect();
        }
    }

    function removeColumn(colId) {
        let selected = getSelectedColumnIds();
        selected = selected.filter(id => id !== colId);
        common.settingsStore.set('selectedColumns', JSON.stringify(selected));
        renderColumnPicker();
        populateSortColumnSelect();
    }

    function moveColumn(colId, direction) {
        const selected = getSelectedColumnIds();
        const index = selected.indexOf(colId);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= selected.length) return;

        [selected[index], selected[newIndex]] = [selected[newIndex], selected[index]];
        common.settingsStore.set('selectedColumns', JSON.stringify(selected));
        renderColumnPicker();
    }
}

/**
 * Populate sort column select with selected columns
 */
function populateSortColumnSelect() {
    const select = document.getElementById('sort-column-select');
    if (!select) return;

    const selectedIds = (() => {
        try {
            return JSON.parse(common.settingsStore.get('selectedColumns') || '[]');
        } catch {
            return [...DEFAULT_COLUMNS];
        }
    })();

    const currentValue = common.settingsStore.get('defaultSortColumn') || 'wkg60';

    select.innerHTML = '';
    for (const colId of selectedIds) {
        const col = AVAILABLE_COLUMNS.find(c => c.id === colId);
        if (!col) continue;

        const option = document.createElement('option');
        option.value = col.id;
        option.textContent = col.label;
        option.selected = col.id === currentValue;
        select.appendChild(option);
    }
}
