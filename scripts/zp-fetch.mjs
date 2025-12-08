#!/usr/bin/env node
/**
 * ZwiftPower Profile Fetcher
 *
 * A Node.js script to fetch athlete profile data from ZwiftPower.
 * This script works around browser CORS restrictions by running in Node.js.
 *
 * Usage:
 *   node zp-fetch.mjs <athleteId> [athleteId2] [athleteId3] ...
 *
 * Environment Variables:
 *   ZWIFT_USERNAME - Your Zwift username/email
 *   ZWIFT_PASSWORD - Your Zwift password
 *
 * Or create a .env file in this directory with:
 *   ZWIFT_USERNAME=your@email.com
 *   ZWIFT_PASSWORD=yourpassword
 *
 * Output:
 *   Saves JSON files to ./zp-profiles/ directory
 *   e.g., ./zp-profiles/87402_all.json
 *
 * Example:
 *   node zp-fetch.mjs 87402
 *   node zp-fetch.mjs 87402 123456 789012
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file if it exists
function loadEnv() {
    const envPath = join(__dirname, '.env');
    if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, 'utf-8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                if (key && value) {
                    process.env[key.trim()] = value.trim();
                }
            }
        }
    }
}

loadEnv();

const CONFIG = {
    baseUrl: 'https://zwiftpower.com',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    outputDir: join(__dirname, 'zp-profiles')
};

/**
 * ZwiftPower Client for Node.js
 */
class ZPClient {
    constructor() {
        this.cookies = new Map();
        this.isAuthenticated = false;
    }

    /**
     * Parse Set-Cookie headers and store cookies
     */
    parseCookies(response) {
        const setCookies = response.headers.getSetCookie?.() || [];
        for (const cookie of setCookies) {
            const [nameValue] = cookie.split(';');
            const [name, value] = nameValue.split('=');
            if (name && value) {
                this.cookies.set(name.trim(), value.trim());
            }
        }
    }

    /**
     * Get cookie header string
     */
    getCookieHeader() {
        return Array.from(this.cookies.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
    }

    /**
     * Make an HTTP request with cookies
     */
    async fetch(url, options = {}) {
        const headers = {
            'User-Agent': CONFIG.userAgent,
            ...options.headers
        };

        if (this.cookies.size > 0) {
            headers['Cookie'] = this.getCookieHeader();
        }

        const response = await fetch(url, {
            ...options,
            headers,
            redirect: 'manual' // Handle redirects manually to capture cookies
        });

        this.parseCookies(response);

        // Handle redirects manually
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const redirectUrl = location.startsWith('http')
                    ? location
                    : new URL(location, url).toString();
                return this.fetch(redirectUrl, { ...options, method: 'GET', body: undefined });
            }
        }

        return response;
    }

    /**
     * Login to ZwiftPower via Zwift OAuth
     */
    async login(username, password) {
        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        console.log('🔐 Logging in to ZwiftPower...');

        // Step 1: Initialize session
        await this.fetch(CONFIG.baseUrl);

        // Step 2: Start OAuth flow
        const oauthUrl = `${CONFIG.baseUrl}/ucp.php?mode=login&login=external&oauth_service=oauthzpsso`;
        const oauthResponse = await this.fetch(oauthUrl);
        const oauthHtml = await oauthResponse.text();

        // Step 3: Extract form action URL
        const formMatch = oauthHtml.match(/<form[^>]*action="([^"]+)"/i);
        if (!formMatch) {
            throw new Error('Could not find login form. ZwiftPower may have changed their login flow.');
        }
        const postUrl = formMatch[1].replace(/&amp;/g, '&');

        // Step 4: Submit credentials
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('rememberMe', 'on');

        const loginResponse = await this.fetch(postUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const finalUrl = loginResponse.url || '';
        const responseText = await loginResponse.text();

        // Step 5: Verify login success
        if (responseText.toLowerCase().includes('invalid username or password')) {
            throw new Error('Invalid username or password');
        }

        if (finalUrl.includes('secure.zwift.com')) {
            throw new Error('Login failed - stuck at Zwift login page');
        }

        // Check if we can access events page
        const eventsResponse = await this.fetch(`${CONFIG.baseUrl}/events.php`);
        const eventsText = await eventsResponse.text();

        if (eventsText.includes('Login Required')) {
            throw new Error('Login failed - still requires authentication');
        }

        this.isAuthenticated = true;
        console.log('✅ Successfully logged in to ZwiftPower');
        return true;
    }

    /**
     * Fetch athlete profile data
     */
    async getProfile(athleteId) {
        const url = `${CONFIG.baseUrl}/cache3/profile/${athleteId}_all.json`;
        console.log(`📥 Fetching profile for athlete ${athleteId}...`);

        const response = await this.fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Athlete ${athleteId} not found on ZwiftPower`);
            }
            throw new Error(`Failed to fetch profile: HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
    }
}

/**
 * Save profile data to JSON file
 */
function saveProfile(athleteId, data) {
    // Ensure output directory exists
    if (!existsSync(CONFIG.outputDir)) {
        mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const filename = `${athleteId}_all.json`;
    const filepath = join(CONFIG.outputDir, filename);

    writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved: ${filepath}`);

    return filepath;
}

/**
 * Extract and display summary from profile data
 */
function displaySummary(athleteId, data) {
    if (!data.data || data.data.length === 0) {
        console.log(`   No race data found for athlete ${athleteId}`);
        return;
    }

    const races = data.data;
    const first = races[0];

    // Find best power values
    let best = {
        name: first.name || `Athlete ${athleteId}`,
        team: first.tname || '',
        raceCount: races.length,
        w5: 0, w15: 0, w60: 0, w300: 0, w1200: 0,
        hrmax: 0
    };

    for (const race of races) {
        const w5 = parseInt(race.w5?.[0]) || 0;
        const w15 = parseInt(race.w15?.[0]) || 0;
        const w60 = parseInt(race.w60?.[0]) || 0;
        const w300 = parseInt(race.w300?.[0]) || 0;
        const w1200 = parseInt(race.w1200?.[0]) || 0;
        const hrmax = parseInt(race.hrmax?.[0]) || 0;

        if (w5 > best.w5) best.w5 = w5;
        if (w15 > best.w15) best.w15 = w15;
        if (w60 > best.w60) best.w60 = w60;
        if (w300 > best.w300) best.w300 = w300;
        if (w1200 > best.w1200) best.w1200 = w1200;
        if (hrmax > best.hrmax) best.hrmax = hrmax;
    }

    console.log(`   📊 ${best.name}`);
    if (best.team) console.log(`      Team: ${best.team}`);
    console.log(`      Races: ${best.raceCount}`);
    if (best.hrmax) console.log(`      Max HR: ${best.hrmax} bpm`);
    console.log(`      Best Power: 5s=${best.w5}W, 1m=${best.w60}W, 5m=${best.w300}W, 20m=${best.w1200}W`);
}

/**
 * Main entry point
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
ZwiftPower Profile Fetcher
==========================

Usage:
  node zp-fetch.mjs <athleteId> [athleteId2] ...

Environment Variables (or use .env file):
  ZWIFT_USERNAME  Your Zwift username/email
  ZWIFT_PASSWORD  Your Zwift password

Examples:
  node zp-fetch.mjs 87402
  node zp-fetch.mjs 87402 123456 789012

Output:
  JSON files saved to ./zp-profiles/
  Import these files in the GOTTA.BIKE mod's ZwiftPower tab.
`);
        process.exit(0);
    }

    // Parse athlete IDs
    const athleteIds = args
        .map(arg => parseInt(arg))
        .filter(id => !isNaN(id) && id > 0);

    if (athleteIds.length === 0) {
        console.error('❌ Error: No valid athlete IDs provided');
        process.exit(1);
    }

    // Get credentials
    const username = process.env.ZWIFT_USERNAME;
    const password = process.env.ZWIFT_PASSWORD;

    if (!username || !password) {
        console.error(`
❌ Error: Credentials not found

Set environment variables:
  export ZWIFT_USERNAME="your@email.com"
  export ZWIFT_PASSWORD="yourpassword"

Or create a .env file in ${__dirname}:
  ZWIFT_USERNAME=your@email.com
  ZWIFT_PASSWORD=yourpassword
`);
        process.exit(1);
    }

    // Initialize client and login
    const client = new ZPClient();

    try {
        await client.login(username, password);
    } catch (error) {
        console.error(`❌ Login failed: ${error.message}`);
        process.exit(1);
    }

    // Fetch each profile
    console.log(`\n📋 Fetching ${athleteIds.length} profile(s)...\n`);

    const results = { success: [], failed: [] };

    for (const athleteId of athleteIds) {
        try {
            const data = await client.getProfile(athleteId);
            const filepath = saveProfile(athleteId, data);
            displaySummary(athleteId, data);
            results.success.push({ athleteId, filepath });
        } catch (error) {
            console.error(`❌ Failed to fetch ${athleteId}: ${error.message}`);
            results.failed.push({ athleteId, error: error.message });
        }
        console.log('');
    }

    // Summary
    console.log('═'.repeat(50));
    console.log(`✅ Success: ${results.success.length}  ❌ Failed: ${results.failed.length}`);

    if (results.success.length > 0) {
        console.log(`\n📁 Files saved to: ${CONFIG.outputDir}`);
        console.log('\nImport these files in the GOTTA.BIKE mod:');
        console.log('  Settings → ZwiftPower tab → Choose JSON File');
    }
}

/**
 * HTTP Server mode - allows the mod to fetch profiles directly
 */
async function startServer(port = 5050) {
    const http = await import('http');

    const server = http.createServer(async (req, res) => {
        // CORS headers for local requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://localhost:${port}`);

        if (url.pathname === '/fetch') {
            const athleteId = url.searchParams.get('athleteId');
            const username = url.searchParams.get('username');
            const password = url.searchParams.get('password');

            if (!athleteId || !username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required parameters: athleteId, username, password' }));
                return;
            }

            try {
                const client = new ZPClient();
                await client.login(username, password);
                const data = await client.getProfile(parseInt(athleteId));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    athleteId: parseInt(athleteId),
                    data: data.data || []
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }

        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`🚀 ZwiftPower Fetch Server running at http://127.0.0.1:${port}`);
        console.log('   Endpoints:');
        console.log('     GET /fetch?athleteId=XXX&username=YYY&password=ZZZ');
        console.log('     GET /health');
        console.log('\n   Press Ctrl+C to stop\n');
    });
}

// Check for server mode
if (process.argv.includes('--server') || process.argv.includes('-s')) {
    const portArg = process.argv.find(a => a.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1]) : 5050;
    startServer(port);
} else {
    main().catch(error => {
        console.error(`❌ Unexpected error: ${error.message}`);
        process.exit(1);
    });
}
