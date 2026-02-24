// Torn War Intel - Clean App Logic
// Refactored: app.js focuses on UI and app flow, state.js manages all state

document.addEventListener("DOMContentLoaded", async function () {
    // Initialize state
    const appState = new AppState();
    await appState.loadFfDefaults();

    // DOM references
    const dom = {
        apikeyInput: document.getElementById("apikey"),
        apikeyClear: document.getElementById("apikey-clear"),
        apikeyStatus: document.getElementById("apikey-status"),
        apikeyApply: document.getElementById("apikey-apply"),
        refreshPeriodInput: document.getElementById("refresh-period"),
        refreshIcon: document.getElementById("refresh-icon"),
        playerTableBody: document.getElementById("player-table-body"),
        metadataLastRun: document.getElementById("metadata-last-run"),
        playersTitle: document.getElementById("players-title"),
        filterForm: document.getElementById("player-filters"),
        filterLevelMin: document.getElementById("level-min"),
        filterLevelMax: document.getElementById("level-max"),
        filterBsMin: document.getElementById("bs-min"),
        filterBsMax: document.getElementById("bs-max"),
        filterOkayOnly: document.getElementById("filter-okay-only"),
        filterLocation: document.getElementById("location-filter")
    };

    // UI status helper
    function setStatus(msg, isError) {
        dom.apikeyStatus.textContent = msg;
        dom.apikeyStatus.style.color = isError ? '#c00' : '#333';
        dom.apikeyStatus.classList.remove("hidden");
    }

    // API key apply handler
    dom.apikeyApply.addEventListener("click", async () => {
        const key = dom.apikeyInput.type === "password" ? appState.getState().apikey : dom.apikeyInput.value.trim();
        const refreshPeriod = Number(dom.refreshPeriodInput.value);
        // Only update state after validation
        if (!key) {
            setStatus("API key missing", true);
            dom.apikeyStatus.classList.remove("hidden");
            return;
        }
        setStatus("Validating API key...");
        dom.refreshIcon.classList.remove("hidden");
        dom.apikeyApply.disabled = true;
        try {
            const userResp = await window.api.getUser(key);
            if (userResp && userResp.error) {
                setStatus(userResp.error.error || "Invalid API key", true);
                dom.apikeyApply.disabled = false;
                dom.refreshIcon.classList.add("hidden");
                return;
            }
            // Only now update state and mask input
            const state = appState.getState();
            state.apikey = key;
            if (!isNaN(refreshPeriod) && refreshPeriod > 0) state.refreshPeriod = refreshPeriod;
            appState.setState(state);
            updateApiKeyUI();
            dom.refreshPeriodInput.value = appState.getState().refreshPeriod || 10;
            setStatus("API key loaded");
            startRefreshLoop();
        } catch (e) {
            setStatus("Network error validating API key", true);
        } finally {
            dom.apikeyApply.disabled = false;
            dom.refreshIcon.classList.add("hidden");
        }
    });

    // Refresh loop and player data fetch
    let refreshInterval = null;
    function startRefreshLoop() {
        if (refreshInterval) clearInterval(refreshInterval);
        const state = appState.getState();
        refreshInterval = setInterval(refreshPlayers, (state.refreshPeriod || 10) * 1000);
        refreshPlayers();
    }
    async function refreshPlayers() {
        const state = appState.getState();
        if (!state.apikey) return;
        setStatus("Refreshing player data...");
        if (dom.refreshIcon) dom.refreshIcon.classList.remove("hidden");
        let factionId = appState.getFactionId();
        if (!factionId) {
            setStatus("No faction ID available", true);
            if (dom.refreshIcon) dom.refreshIcon.classList.add("hidden");
            return;
        }
        try {
            const result = await window.api.getFaction(factionId, state.apikey);
            if (result && result.members) {
                appState.updatePlayersFromApi(Object.values(result.members));
                dom.playersTitle.textContent = result.name || result.faction_name || "Players";
            } else {
                setStatus("No player data found", true);
            }
        } catch (e) {
            setStatus("Error fetching player data", true);
        } finally {
            if (dom.refreshIcon) dom.refreshIcon.classList.add("hidden");
        }
        dom.metadataLastRun.textContent = new Date(Date.now()).toLocaleString();
        refreshPlayerTable();
        setStatus("Player data refreshed");
    }

    // Add this function to app.js
    async function refreshPlayerTable() {
        // Ensure ffDefaults is loaded in AppState
        if (!window.appState) {
            window.appState = new AppState();
            await window.appState.loadFfDefaults();
        }
        // Get players from state.js (AppState)
        const players = window.appState.getPlayers();
        const dom = {
            playerTableBody: document.getElementById("player-table-body"),
            playersTitle: document.getElementById("players-title")
        };
        if (!players || Object.keys(players).length === 0) {
            dom.playerTableBody.innerHTML = "<tr><td colspan='7'>No player data available</td></tr>";
            dom.playersTitle.textContent = `${window.appState.getFactionName() || "Faction"} [${window.appState.getFactionId() || "--"}]`;
            return;
        }
        dom.playerTableBody.innerHTML = "";
        Object.values(players).forEach(p => {
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
        dom.playersTitle.textContent = `${window.appState.getFactionName() || "Faction"} [${window.appState.getFactionId() || "--"}]`;
    }

    // On DOMContentLoaded, set input values from state and handle apikey logic
    const initialState = appState.getState();
    function updateApiKeyUI() {
        const state = appState.getState();
        if (state.apikey) {
            dom.apikeyInput.type = "password";
            dom.apikeyInput.value = "********";
            dom.apikeyInput.disabled = true;
            dom.apikeyClear.classList.remove("hidden");
        } else {
            dom.apikeyInput.type = "text";
            dom.apikeyInput.value = "";
            dom.apikeyInput.disabled = false;
            dom.apikeyClear.classList.add("hidden");
        }
    }
    updateApiKeyUI();
    dom.refreshPeriodInput.value = initialState.refreshPeriod || 10;

    // Add clear button handler
    dom.apikeyClear.addEventListener("click", function() {
        const state = appState.getState();
        state.apikey = "";
        appState.setState(state);
        updateApiKeyUI();
        setStatus("API key cleared", false);
    });

    // On load, check for apikey and validate if present
    async function checkAndValidateApiKeyOnLoad() {
        const state = appState.getState();
        if (!state.apikey) {
            setStatus("API key missing", true);
            dom.apikeyStatus.classList.remove("hidden");
            return;
        }
        setStatus("Validating API key...");
        dom.refreshIcon.classList.remove("hidden");
        dom.apikeyApply.disabled = true;
        try {
            const userResp = await window.api.getUser(state.apikey);
            if (userResp && userResp.error) {
                setStatus(userResp.error.error || "Invalid API key", true);
                dom.apikeyApply.disabled = false;
                dom.refreshIcon.classList.add("hidden");
                return;
            }
            setStatus("API key loaded");
            startRefreshLoop();
        } catch (e) {
            setStatus("Network error validating API key", true);
        } finally {
            dom.apikeyApply.disabled = false;
            dom.refreshIcon.classList.add("hidden");
        }
    }
    checkAndValidateApiKeyOnLoad();

    // On DOMContentLoaded, call refreshPlayerTable
    refreshPlayerTable();

    // Initial load
    const state = appState.getState();
    dom.refreshPeriodInput.value = state.refreshPeriod || 10;
    if (state.apikey) setStatus("API key loaded");
    else setStatus("No API key loaded", true);
});
