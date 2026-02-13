// Torn War Intel - Clean App Logic
document.addEventListener("DOMContentLoaded", function () {
    // Cache DOM elements
    const dom = {
        apikeyInput: document.getElementById("apikey-input"),
        apikeyRemember: document.getElementById("apikey-remember"),
        apikeyApply: document.getElementById("apikey-apply"),
        apikeyStatus: document.getElementById("apikey-status"),
        refreshPeriodInput: document.getElementById("refresh-period-input"),
        settingsApply: document.getElementById("settings-apply"),
        playerTableBody: document.getElementById("player-table-body"),
        metadataLastRun: document.getElementById("metadata-last-run"),
        playersTitle: document.getElementById("players-title")
    };

    // Check for required DOM elements and fail gracefully if missing
    for (const [key, el] of Object.entries(dom)) {
        if (!el) {
            console.error(`Missing DOM element: ${key}`);
            return;
        }
    }

    // App state
    let state = {
        apikey: null,
        refreshPeriod: 10,
        lastRefreshTimestamp: null,
        players: [],
        faction_id: null
    };

    // State persistence
    function loadStateFromStorage() {
        const stored = localStorage.getItem("tornwarintel_state");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                state = { ...state, ...parsed };
            } catch (e) {}
        }
        const apikey = localStorage.getItem("tornwarintel_apikey");
        if (apikey) state.apikey = apikey;
    }
    function saveStateToStorage() {
        const { apikey, ...toStore } = state;
        localStorage.setItem("tornwarintel_state", JSON.stringify(toStore));
        if (apikey) localStorage.setItem("tornwarintel_apikey", apikey);
        else localStorage.removeItem("tornwarintel_apikey");
    }

    // UI status helper
    function setStatus(text, isError = false) {
        dom.apikeyStatus.textContent = text;
        dom.apikeyStatus.classList.toggle("status-error", isError);
    }

    // Render player table
    function renderPlayers() {
        if (!state.players || !state.players.length) {
            dom.playerTableBody.innerHTML = "<tr><td colspan='7'>No player data available</td></tr>";
            // Set table title even if no data
            const fname = window.FFSCOUTER_DEFAULTS?.faction_name || "Faction";
            const fid = window.FFSCOUTER_DEFAULTS?.faction_id || "--";
            dom.playersTitle.textContent = `${fname} [${fid}]`;
            return;
        }
        // Set table title from FFSCOUTER_DEFAULTS or first player
        const fname = window.FFSCOUTER_DEFAULTS?.faction_name || state.players[0].faction_name || "Faction";
        const fid = window.FFSCOUTER_DEFAULTS?.faction_id || state.players[0].faction_id || "--";
        dom.playersTitle.textContent = `${fname} [${fid}]`;
        dom.playerTableBody.innerHTML = "";
        state.players.forEach(p => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${p.id || "--"}</td>
                <td>${p.name || "--"}</td>
                <td>${p.level || "--"}</td>
                <td>${p.status?.description || p.status || "--"}</td>
                <td>${p.hospital_leave || p.hospitalLeaveTime || p.until_ok || "--"}</td>
                <td>${p.last_action?.relative || p.last_action || "--"}</td>
                <td>${p.bs_estimate_human || p.bs_estimate || p.bs || "--"}</td>
            `;
            dom.playerTableBody.appendChild(row);
        });
    }

    // Null checks for DOM elements before adding event listeners
    if (!dom.apikeyApply || !dom.apikeyInput || !dom.apikeyRemember || !dom.settingsApply || !dom.refreshPeriodInput) {
        console.error("One or more required DOM elements are missing. Please check your HTML IDs.", dom);
        return;
    }

    // API key apply handler
    dom.apikeyApply.addEventListener("click", async () => {
        const key = dom.apikeyInput.value.trim();
        if (!key) {
            setStatus("No API key loaded", true);
            return;
        }
        setStatus("Validating API key...");
        dom.apikeyApply.disabled = true;
        try {
            const userResp = await window.api.getUser(key);
            if (userResp && userResp.error) {
                setStatus(userResp.error.error || "Invalid API key", true);
                dom.apikeyApply.disabled = false;
                return;
            }
            state.apikey = key;
            if (dom.apikeyRemember.checked) {
                localStorage.setItem("tornwarintel_apikey", key);
            }
            setStatus("API key loaded");
            saveStateToStorage();
            startRefreshLoop();
        } catch (e) {
            setStatus("Network error validating API key", true);
        } finally {
            dom.apikeyApply.disabled = false;
        }
    });

    // Refresh period apply handler
    dom.settingsApply.addEventListener("click", () => {
        let val = parseInt(dom.refreshPeriodInput.value, 10);
        if (isNaN(val) || val < 10) val = 10;
        state.refreshPeriod = val;
        dom.refreshPeriodInput.value = val;
        saveStateToStorage();
        if (state.apikey) startRefreshLoop();
    });

    // Refresh loop and player data fetch
    let refreshInterval = null;
    function startRefreshLoop() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(refreshPlayers, state.refreshPeriod * 1000);
        refreshPlayers();
    }
    async function refreshPlayers() {
        if (!state.apikey) return;
        setStatus("Refreshing player data...");
        // Use global FFSCOUTER_DEFAULTS for faction_id if not already loaded
        let factionId = state.faction_id;
        if (!factionId && window.FFSCOUTER_DEFAULTS) {
            factionId = window.FFSCOUTER_DEFAULTS.faction_id;
            state.faction_id = factionId;
        }
        if (!factionId) {
            setStatus("No faction ID available", true);
            return;
        }
        // Fetch player data from Torn API
        try {
            const result = await window.api.getFaction(factionId, state.apikey);
            if (result && result.members) {
                state.players = Object.entries(result.members).map(([id, player]) => ({
                    id,
                    ...player,
                    bs_estimate_human: player.bs_estimate_human || player.bs_estimate || player.bs || "--"
                }));
                dom.playersTitle.textContent = result.name || result.faction_name || "Players";
            } else {
                setStatus("No player data found", true);
            }
        } catch (e) {
            setStatus("Error fetching player data", true);
        }
        state.lastRefreshTimestamp = Date.now();
        dom.metadataLastRun.textContent = new Date(state.lastRefreshTimestamp).toLocaleString();
        saveStateToStorage();
        renderPlayers();
        setStatus("Player data refreshed");
    }

    // Initial load
    loadStateFromStorage();
    dom.refreshPeriodInput.value = state.refreshPeriod;
    if (state.apikey) setStatus("API key loaded");
    else setStatus("No API key loaded", true);
    if ((!state.players || !state.players.length) && window.FFSCOUTER_DEFAULTS) {
        state.players = Object.entries(window.FFSCOUTER_DEFAULTS.data).map(([id, bs_estimate_human]) => ({ id, bs_estimate_human }));
        dom.playersTitle.textContent = window.FFSCOUTER_DEFAULTS.faction_name || "Players";
        renderPlayers();
    } else {
        renderPlayers();
    }
});
