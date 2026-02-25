(function () {
    const dom = {
        apikeyInput: document.getElementById("apikey-input"),
        apikeyInputRow: document.getElementById("apikey-input-row"),
        apikeyRemember: document.getElementById("apikey-remember"),
        apikeyRememberWrap: document.getElementById("apikey-remember-wrap"),
        apikeyStatus: document.getElementById("apikey-status"),
        apikeyApply: document.getElementById("apikey-apply"),
        apikeyClear: document.getElementById("apikey-clear"),
        apikeyPrompt: document.getElementById("apikey-prompt"),
        apikeyDisplayRow: document.getElementById("apikey-display-row"),
        refreshPeriodInput: document.getElementById("refresh-period-input"),
        settingsApply: document.getElementById("settings-apply"),
        settingsStatus: document.getElementById("settings-status"),
        metaToggle: document.getElementById("meta-toggle"),
        metaContent: document.getElementById("meta-content"),
        filtersToggle: document.getElementById("filters-toggle"),
        filtersContent: document.getElementById("filters-content"),
        
        userBox: document.getElementById("userinfo-box"),
        userInfoContent: document.getElementById("user-info-content"),
        // team table removed from DOM; references will be null
        teamTableBody: document.getElementById("team-table-body"),
        teamTableHeaders: document.querySelectorAll("#team-table thead th[data-col]"),
        playersTitle: document.getElementById("players-title"),
        playerTableBody: document.getElementById("player-table-body"),
        playerTableHeaders: document.querySelectorAll("#player-table thead th[data-col]"),
        levelMinInput: document.getElementById("level-min"),
        levelMaxInput: document.getElementById("level-max"),
        bsMinInput: document.getElementById("bs-min"),
        bsMaxInput: document.getElementById("bs-max"),
        fairFightMinInput: document.getElementById("fair-fight-min"),
        fairFightMaxInput: document.getElementById("fair-fight-max"),
        filterOkayOnly: document.getElementById("filter-okay-only"),
        locationFilter: document.getElementById("location-filter"),
        metadataTimerLabel: document.getElementById("metadata-refresh-timer"),
        metadataIcon: document.getElementById("metadata-refresh-icon"),
        metadataLastRun: document.getElementById("metadata-last-run"),
        teamTimerLabel: document.getElementById("team-refresh-timer"),
        teamIcon: document.getElementById("team-refresh-icon")
        ,teamLastRun: document.getElementById("team-last-run")
    };

    const LOCATION = Object.freeze({
        ARGENTINA: "Argentina",
        CANADA: "Canada",
        CAYMAN_ISLANDS: "Cayman Islands",
        CHINA: "China",
        HAWAII: "Hawaii",
        JAPAN: "Japan",
        MEXICO: "Mexico",
        SOUTH_AFRICA: "South Africa",
        SWITZERLAND: "Switzerland",
        UAE: "UAE",
        UNITED_KINGDOM: "United Kingdom",
        TORN: "Torn"
    });

    const LOCATION_SYNONYMS = buildLocationSynonymMap();

    const intervals = { metadata: null, team: null, countdown: null };
    let offlineTeamLookup = null;
    let offlineTeamLookupPromise = null;
    const teamFetchInFlight = new Map();
    const teamRefreshStart = new Map();
    const sortState = {
        team: { column: null, direction: "asc" },
        player: { column: "fair_fight", direction: "asc" }
    };
    let metadataRefreshInFlight = null;
    let metadataRefreshStart = 0;

    function isPinkPowerTeam(teamLike) {
        if (!teamLike) return false;
        const numericId = Number(teamLike.id);
        const normalizedName = typeof teamLike.name === "string"
            ? teamLike.name.trim().toLowerCase()
            : "";

        if (!Number.isNaN(numericId) && numericId === 1) return true;
        return normalizedName.includes("pink power");
    }

    function isHiddenTeam() {
        return false;
    }

    function getVisibleTeams(teams = state.teams) {
        if (!Array.isArray(teams)) return [];
        return teams;
    }

    function normalizeTeamId(id) {
        if (id === null || id === undefined) return null;
        return String(id);
    }

    function ensureValidSelectedTeam() {
        const teams = Array.isArray(state.teams) ? getVisibleTeams(state.teams) : [];
        const availableIds = new Set(
            teams
                .map(t => normalizeTeamId(t?.id))
                .filter(id => id !== null)
        );

        Object.keys(state.teamPlayers || {}).forEach(idStr => {
            const normalized = normalizeTeamId(idStr);
            if (normalized !== null && !isHiddenTeam({ id: normalized })) {
                availableIds.add(normalized);
            }
        });

        const current = normalizeTeamId(state.selectedTeamId);
        if (current !== null && availableIds.has(current)) {
            return state.selectedTeamId;
        }

        const fallback = teams[0]?.id ?? Array.from(availableIds)[0] ?? null;
        state.saveSelectedTeamId(fallback ?? null);
        return fallback;
    }

    function setStatus(el, text, isError = false, hide = false) {
        if (!el) return;
        el.textContent = text;
        el.classList.toggle("status-error", Boolean(isError));
        el.classList.toggle("hidden", Boolean(hide));
    }

    function setApiKeyApplyMode() {
        dom.apikeyInputRow.classList.remove("hidden");
        dom.apikeyDisplayRow.classList.add("hidden");
        dom.apikeyPrompt.classList.add("hidden");
        dom.apikeyRememberWrap.classList.remove("hidden");
    }

    function setApiKeyClearMode() {
        dom.apikeyInput.value = "";
        dom.apikeyInputRow.classList.add("hidden");
        dom.apikeyDisplayRow.classList.remove("hidden");
        dom.apikeyPrompt.classList.remove("hidden");
        dom.apikeyRememberWrap.classList.add("hidden");
    }

    function init() {
        state.loadFromStorage();
        if (dom.apikeyRemember) dom.apikeyRemember.checked = state.rememberApiKey;
        dom.apikeyInput.value = "";

        // settings inputs
        if (state.refreshPeriodSeconds) dom.refreshPeriodInput.value = state.refreshPeriodSeconds;

        if (dom.metadataLastRun && state.metadataTimestamp) {
            try { dom.metadataLastRun.textContent = `Last: ${new Date(state.metadataTimestamp).toLocaleTimeString()}`; } catch (e) {}
        }

        if (dom.teamLastRun && state.selectedTeamId) {
            const ts = state.teamPlayersTimestamp[state.selectedTeamId];
            if (ts) {
                try { dom.teamLastRun.textContent = `Last: ${new Date(ts).toLocaleTimeString()}`; } catch (e) {}
            }
        }

        if (state.user) {
            dom.userBox.classList.remove("hidden");
            renderUserInfo();
        }

        if (state.apikey) {
            const hasCachedTeams = Array.isArray(state.teams) && state.teams.length > 0;
            const hasCachedPlayers = state.teamPlayers && Object.keys(state.teamPlayers).length > 0;
            if (hasCachedTeams || hasCachedPlayers) {
                ensureValidSelectedTeam();
                renderPlayers();
                // set dynamic title when a faction is configured
                if (state.factionId && dom.playersTitle) {
                    const cachedName = (state.factionCache && state.factionCache[String(state.factionId)] && state.factionCache[String(state.factionId)].data && state.factionCache[String(state.factionId)].data.name) || `Faction ${state.factionId}`;
                    dom.playersTitle.textContent = `${cachedName} [${state.factionId}]`;
                }
            } else {
                // no static snapshot; start with empty state until API data arrives
            }
            validateAndStart();
        } else {
            showNoKey();
            // no static snapshot usage — leave UI empty until API key provided
        }

        if (dom.apikeyApply) dom.apikeyApply.addEventListener("click", () => {
            const key = dom.apikeyInput.value.trim();
            if (!key) {
                showNoKey();
                return;
            }
            state.saveApiKey(key, dom.apikeyRemember ? dom.apikeyRemember.checked : false);
            validateAndStart();
        });

        if (dom.apikeyClear) dom.apikeyClear.addEventListener("click", () => {
            clearApiKeyAndUi();
        });

        if (dom.settingsApply) dom.settingsApply.addEventListener("click", () => {
            const refreshVal = dom.refreshPeriodInput.value.trim();
            const faction = Number(state.factionId);
            const refreshSec = refreshVal === "" ? 30 : Number(refreshVal);

            state.saveRefreshPeriod(refreshSec);

            setStatus(dom.settingsStatus, "Settings saved", false, false);
            setTimeout(() => setStatus(dom.settingsStatus, "", false, true), 2000);
            // If a faction ID is supplied, immediately fetch and show its members as the main list
            if (faction) {
                const teamKey = `faction:${faction}`;
                state.saveSelectedTeamId(teamKey);
                (async () => {
                    try {
                        await fetchAndCacheFactionMembers(faction, true);

                        // persist teams metadata so selected faction team remains
                        const existing = state.teams.filter(t => String(t.id) !== String(teamKey));
                        existing.unshift({ id: teamKey, name: `Faction ${faction}`, participants: (state.teamPlayers[teamKey] || []).length });
                        state.teams = existing;
                        state.cacheMetadata(state.user, state.teams);
                        renderTeams();
                        renderPlayers();
                    } catch (err) {
                        console.warn('Failed to fetch faction members', err);
                    }
                })();
            }
        });

        // when settings are applied we will handle faction ID refresh behavior

        attachFilterListeners();
        attachSortListeners();
        attachSectionToggles();
    }

    function setCollapsedState(toggleBtn, contentEl, isCollapsed) {
        if (!toggleBtn || !contentEl) return;
        toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
        contentEl.classList.toggle("is-collapsed", isCollapsed);
    }

    function getSectionStorageKey(contentEl) {
        if (!contentEl?.id) return null;
        return `sectionCollapsed:${contentEl.id}`;
    }

    function loadCollapsedState(contentEl) {
        const key = getSectionStorageKey(contentEl);
        if (!key) return null;

        const value = localStorage.getItem(key);
        if (value === "true") return true;
        if (value === "false") return false;
        return null;
    }

    function saveCollapsedState(contentEl, isCollapsed) {
        const key = getSectionStorageKey(contentEl);
        if (!key) return;
        localStorage.setItem(key, String(Boolean(isCollapsed)));
    }

    function restoreSectionCollapsedState(toggleBtn, contentEl) {
        if (!toggleBtn || !contentEl) return;
        const savedState = loadCollapsedState(contentEl);
        if (savedState === null) return;
        setCollapsedState(toggleBtn, contentEl, savedState);
    }

    function attachSectionToggles() {
        if (dom.metaToggle && dom.metaContent) {
            restoreSectionCollapsedState(dom.metaToggle, dom.metaContent);
            dom.metaToggle.addEventListener("click", () => {
                const expanded = dom.metaToggle.getAttribute("aria-expanded") === "true";
                setCollapsedState(dom.metaToggle, dom.metaContent, expanded);
                saveCollapsedState(dom.metaContent, expanded);
            });
        }

        if (dom.filtersToggle && dom.filtersContent) {
            restoreSectionCollapsedState(dom.filtersToggle, dom.filtersContent);
            dom.filtersToggle.addEventListener("click", () => {
                const expanded = dom.filtersToggle.getAttribute("aria-expanded") === "true";
                setCollapsedState(dom.filtersToggle, dom.filtersContent, expanded);
                saveCollapsedState(dom.filtersContent, expanded);
            });
        }
    }

    async function validateAndStart() {
        setStatus(dom.apikeyStatus, "Validating...", false, false);

        const data = await api.getUser(state.apikey);
        if (data.error || !data.profile) {
            stopIntervals();
            clearAuthenticatedState();
            state.clearApiKey();
            if (dom.apikeyRemember) dom.apikeyRemember.checked = false;
            showNoKey("API key invalid");
            return;
        }

        state.user = await attachOfflineTeamToUser(data.profile);
        enforcePinkPowerRestriction(state.user);
        setStatus(dom.apikeyStatus, "API key loaded", false, true);
        setApiKeyClearMode();
        dom.userBox.classList.remove("hidden");

        renderUserInfo();
        startMetadataCountdown();
        startTeamCountdown();
        if (state.selectedTeamId) {
            refreshTeamPlayers(true);
        }
    }

    function stopIntervals() {
        if (intervals.metadata) clearInterval(intervals.metadata);
        if (intervals.team) clearInterval(intervals.team);
        if (intervals.countdown) clearInterval(intervals.countdown);
        intervals.metadata = intervals.team = intervals.countdown = null;
    }

    function showNoKey(message = "No API key loaded") {
        state.clearApiKey();
        setApiKeyApplyMode();
        dom.apikeyInput.value = "";
        setStatus(dom.apikeyStatus, message, true, false);
    }

    function clearAuthenticatedState() {
        state.clearCachedData();
        dom.userInfoContent.innerHTML = "";
        dom.userBox.classList.add("hidden");
        dom.metadataTimerLabel.textContent = "Next refresh: --";
        dom.teamTimerLabel.textContent = "Next refresh: --";
        dom.metadataIcon.classList.add("hidden");
        dom.teamIcon.classList.add("hidden");

        renderTeams();
        renderPlayers();
    }

    function clearApiKeyAndUi() {
        stopIntervals();
        state.clearApiKey();
        if (dom.apikeyRemember) dom.apikeyRemember.checked = false;
        clearAuthenticatedState();
        showNoKey();
        dom.apikeyInput.focus();
        // static snapshot removed; nothing to load
    }

    // static snapshot loading removed — caching now only in localStorage via state.*

    async function refreshMetadata(force = false) {
        if (metadataRefreshInFlight) {
            await metadataRefreshInFlight;
            return;
        }

        const now = Date.now();
        if (!force && !state.shouldRefreshMetadata(now)) return;
        if (now - metadataRefreshStart < state.MIN_REFRESH_MS) return;

        metadataRefreshStart = now;
        dom.metadataIcon.classList.remove("hidden");

        const refreshPromise = (async () => {
            const userData = await api.getUser(state.apikey);

            if (!userData.error && userData.profile) {
                state.user = await attachOfflineTeamToUser(userData.profile);
                enforcePinkPowerRestriction(state.user);
                renderUserInfo();
            }

            // This app now manages a single faction only. If a factionId is configured,
            // refresh its members and metadata; otherwise clear teams metadata.
            if (state.factionId) {
                try {
                    await fetchAndCacheFactionMembers(state.factionId, true);
                    ensureValidSelectedTeam();
                    renderTeams();
                } catch (err) {
                    console.warn('Failed to refresh faction during metadata refresh', err);
                }
            } else {
                state.teams = [];
                ensureValidSelectedTeam();
                renderTeams();
            }

            state.cacheMetadata(state.user, state.teams);
            dom.metadataIcon.classList.add("hidden");
            if (dom.metadataLastRun) {
                try {
                    dom.metadataLastRun.textContent = `Last: ${new Date(state.metadataTimestamp).toLocaleTimeString()}`;
                } catch (e) {
                    /* ignore */
                }
            }
        })();

        metadataRefreshInFlight = refreshPromise;
        try {
            await refreshPromise;
        } finally {
            metadataRefreshInFlight = null;
        }
    }

    // Faction import and rendering removed — faction members are shown directly in the main players table

    function renderUserInfo() {
        const u = state.user;
        if (!u) return;

        const stateColor = mapStateColor(u.status.state);
        const statusText = simplifyStatus(u.status);
        dom.userInfoContent.innerHTML = `
            <div><strong>${u.name}</strong> [${u.level}]</div>
            <div class="${stateColor}">${statusText}</div>
        `;
    }

    async function attachOfflineTeamToUser(user) {
        // offline snapshot removed — return user unchanged
        return user;
    }

    function enforcePinkPowerRestriction(user) {
        localStorage.removeItem("hidePinkPowerTeam");
        state.hidePinkPowerPermanently();
    }

    function simplifyStatus(statusObj) {
        if (!statusObj) return "Unknown";
        const desc = statusObj.description || statusObj.state;
        if (desc.startsWith("Traveling to")) {
            return desc.replace("Traveling to", "Traveling (") + ")";
        } else if (desc.startsWith("Returning to Torn from")) {
            const place = desc.replace("Returning to Torn from ", "");
            return `Returning from ${place}`;
        }
        return desc;
    }

    function buildLocationSynonymMap() {
        const map = new Map();
        Object.values(LOCATION).forEach(loc => map.set(loc.toLowerCase(), loc));

        const synonyms = [
            ["canadian", LOCATION.CANADA],
            ["canada", LOCATION.CANADA],
            ["argentinian", LOCATION.ARGENTINA],
            ["argentina", LOCATION.ARGENTINA],
            ["cayman", LOCATION.CAYMAN_ISLANDS],
            ["cayman islands", LOCATION.CAYMAN_ISLANDS],
            ["china", LOCATION.CHINA],
            ["chinese", LOCATION.CHINA],
            ["hawaii", LOCATION.HAWAII],
            ["hawaiian", LOCATION.HAWAII],
            ["japan", LOCATION.JAPAN],
            ["japanese", LOCATION.JAPAN],
            ["mexico", LOCATION.MEXICO],
            ["mexican", LOCATION.MEXICO],
            ["south africa", LOCATION.SOUTH_AFRICA],
            ["southafrica", LOCATION.SOUTH_AFRICA],
            ["south african", LOCATION.SOUTH_AFRICA],
            ["switzerland", LOCATION.SWITZERLAND],
            ["swiss", LOCATION.SWITZERLAND],
            ["uae", LOCATION.UAE],
            ["emirati", LOCATION.UAE],
            ["united kingdom", LOCATION.UNITED_KINGDOM],
            ["uk", LOCATION.UNITED_KINGDOM],
            ["british", LOCATION.UNITED_KINGDOM],
            ["torn", LOCATION.TORN]
        ];

        synonyms.forEach(([key, value]) => map.set(key, value));
        return map;
    }

    function normalizeLocationName(rawName) {
        if (!rawName || typeof rawName !== "string") return null;
        const cleaned = rawName.trim().toLowerCase();
        if (!cleaned) return null;
        return LOCATION_SYNONYMS.get(cleaned) || null;
    }

    function extractHospitalLocation(statusObj) {
        if (!statusObj || !statusObj.description) return "Torn";
        const desc = statusObj.description.trim();

        // Try patterns like: In a Hawaiian hospital...
        const match = desc.match(/In\s+(?:a|an)?\s*([A-Za-z]+)\s+hospital/i);
        if (match && match[1]) {
            return match[1];
        }

        // Default if no city is named
        return "Torn";
    }

    function resolveHospitalLocation(statusObj) {
        const raw = extractHospitalLocation(statusObj);
        return normalizeLocationName(raw) || LOCATION.TORN;
    }

    function parseTravelDirection(statusObj) {
        const desc = (statusObj?.description || "").trim();
        const details = statusObj?.details || {};

        if (details.from) {
            return { direction: "from", place: details.from };
        }

        if (details.destination) {
            return { direction: "to", place: details.destination };
        }

        if (details.country) {
            return { direction: "to", place: details.country };
        }

        const returningMatch = desc.match(/returning to torn from\s+(.+)/i);
        if (returningMatch) {
            return { direction: "from", place: returningMatch[1] };
        }

        const travelingFromMatch = desc.match(/traveling from\s+(.+)/i);
        if (travelingFromMatch) {
            return { direction: "from", place: travelingFromMatch[1] };
        }

        const travelingToMatch = desc.match(/traveling to\s+(.+)/i);
        if (travelingToMatch) {
            return { direction: "to", place: travelingToMatch[1] };
        }

        return null;
    }

    function formatTravelingLocation(direction, destination) {
        if (!destination) return null;
        return direction === "from"
            ? `Traveling from ${destination}`
            : `Traveling to ${destination}`;
    }

    function determinePlayerLocation(statusObj) {
        if (!statusObj) return null;
        const stateValue = statusObj.state;

        if (stateValue === "Hospital") {
            return resolveHospitalLocation(statusObj);
        }

        if (stateValue === "Abroad") {
            const destination = normalizeLocationName(getAbroadDestination(statusObj));
            return destination || null;
        }

        if (stateValue === "Traveling") {
            const travel = parseTravelDirection(statusObj);
            if (!travel) return null;

            const normalized = normalizeLocationName(travel.place);
            if (!normalized) return null;
            return formatTravelingLocation(travel.direction, normalized);
        }

        if (stateValue === "Okay") {
            return LOCATION.TORN;
        }

        return LOCATION.TORN;
    }

    function getAbroadDestination(statusObj) {
        if (!statusObj) return null;
        const details = statusObj.details || {};
        if (details.destination) return details.destination;
        if (details.country) return details.country;

        const desc = statusObj.description || "";
        const parenMatch = desc.match(/\(([^)]+)\)/);
        if (parenMatch) return parenMatch[1];

        const inMatch = desc.match(/in\s+([A-Za-z\s]+)$/i);
        if (inMatch) return inMatch[1].trim();

        if (desc.includes(" ")) return desc.split(" ").slice(1).join(" ").trim();
        return null;
    }

    function appendBsEstimatePlaceholders(players) {
        players.forEach(p => {
            if (p.bs_estimate_human === undefined) {
                p.bs_estimate_human = "--";
            }
        });
    }

    function ensurePlayerDefaults(player) {
        if (!player) return player;

        const { rawData, location, ...rest } = player;
        const status = player.status || { state: "--", description: "--" };
        const lastActionRaw = player.last_action || {};
        const lastAction = {
            relative: lastActionRaw.relative ?? "--",
            status: lastActionRaw.status ?? "Unknown",
            timestamp: lastActionRaw.timestamp ?? null
        };
        const canonicalLocation = player.location ?? determinePlayerLocation(status);
        const fairFight = deriveFairFightValue(player);
        const bsEstimateHuman = player.bs_estimate_human === undefined ? "--" : player.bs_estimate_human;
        const bsEstimateNumeric = deriveBsEstimateNumber(player);
        const attacks = player.attacks ?? "--";

        return {
            ...player,
            status,
            last_action: lastAction,
            location: canonicalLocation,
            rawData: rawData || { ...rest },
            fair_fight: fairFight,
            bs_estimate_human: bsEstimateHuman,
            bs_estimate: bsEstimateNumeric,
            attacks
        };
    }

    function transformPlayerFromApi(rawPlayer) {
        return ensurePlayerDefaults({
            ...rawPlayer,
            location: determinePlayerLocation(rawPlayer.status),
            rawData: rawPlayer
        });
    }

    function getPlayerIdentifier(player) {
        const candidates = ["id", "player_id", "user_id", "torn_id", "tornid"];
        for (const key of candidates) {
            if (player[key] !== undefined && player[key] !== null) {
                return player[key];
            }
        }
        return null;
    }

    async function maybeFetchFfScouterStats(players) {
        if (!players.length) return;
        const statsMap = await getDefaultFfStatsMap();
        if (!statsMap.size) return;

        players.forEach(p => {
            const playerId = getPlayerIdentifier(p);
            if (playerId === null || playerId === undefined) return;

            const numericId = Number(playerId);
            const stats = statsMap.get(numericId);
            if (!stats) return;

            if (stats.bs_estimate_human !== undefined) {
                p.bs_estimate_human = stats.bs_estimate_human;
                p.bs_estimate = deriveBsEstimateNumber(p);
            }

            if (stats.fair_fight !== undefined && stats.fair_fight !== null) {
                p.fair_fight = stats.fair_fight;
            }
        });
    }

    let ffDefaultsPromise = null;

    async function getDefaultFfStatsMap() {
        if (!ffDefaultsPromise) {
            ffDefaultsPromise = fetch('ffscouter_defaults.json', { cache: "no-store" })
                .then(resp => resp.ok ? resp.json() : null)
                .catch(() => null);
        }

        const payload = await ffDefaultsPromise;
        const map = new Map();
        const raw = payload && payload.data;

        if (Array.isArray(raw)) {
            raw.forEach(entry => {
                if (!entry || typeof entry !== "object") return;
                const id = Number(entry.player_id ?? entry.playerId ?? entry.id ?? entry.user_id ?? entry.userId);
                if (Number.isNaN(id)) return;
                const bsVal = entry.bs_estimate_human ?? entry.bs_estimate ?? entry.bs;
                const fairFight = parseFairFightValue(entry.fair_fight ?? entry.fairFight ?? entry.ff);
                if ((bsVal === null || bsVal === undefined || bsVal === "") && (fairFight === null || fairFight === undefined)) return;
                map.set(id, {
                    bs_estimate_human: bsVal === null || bsVal === undefined || bsVal === "" ? undefined : String(bsVal),
                    fair_fight: fairFight
                });
            });
            return map;
        }

        const legacyMap = raw && typeof raw === "object" ? raw : {};
        Object.entries(legacyMap).forEach(([id, val]) => {
            const num = Number(id);
            if (Number.isNaN(num)) return;
            if (val === null || val === undefined || val === "") return;
            map.set(num, { bs_estimate_human: String(val), fair_fight: undefined });
        });
        return map;
    }
    function hasMeaningfulBsValue(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === "string") return value.trim() !== "" && value !== "--";
        if (typeof value === "number") return !Number.isNaN(value);
        return false;
    }

    function preserveCachedBattleStats(teamId, players) {
        // Preserve previously-cached battlestat estimates when refreshing
        // the player list. Do not remove existing estimates unless replaced by
        // new values from ffscouter_defaults.json.
        const existing = state.teamPlayers[teamId];
        if (!Array.isArray(existing) || !existing.length) return players;

        const lookup = new Map();
        existing.forEach(player => {
            const id = getPlayerIdentifier(player);
            if (id === null || id === undefined) return;
            lookup.set(id, player);
        });

        players.forEach(player => {
            const id = getPlayerIdentifier(player);
            if (id === null || id === undefined) return;

            const prior = lookup.get(id);
            if (!prior) return;

            const hasNewBs = hasMeaningfulBsValue(player.bs_estimate_human) || hasMeaningfulBsValue(player.bs_estimate);
            if (hasNewBs) return;

            if (hasMeaningfulBsValue(prior.bs_estimate_human)) {
                player.bs_estimate_human = prior.bs_estimate_human;
            }
            if (hasMeaningfulBsValue(prior.bs_estimate)) {
                player.bs_estimate = prior.bs_estimate;
            } else {
                player.bs_estimate = deriveBsEstimateNumber(player);
            }
        });

        return players;
    }

    function attachSortListeners() {
        addSortListeners(dom.teamTableHeaders, "team");
        addSortListeners(dom.playerTableHeaders, "player");
    }

    function addSortListeners(headers, tableType) {
        headers.forEach(th => {
            th.classList.add("sortable");
            th.addEventListener("click", () => handleSort(tableType, th.getAttribute("data-col")));
        });

        updateSortIndicators(tableType);
    }

    function handleSort(tableType, column) {
        const stateRef = sortState[tableType];
        if (!stateRef || !column) return;

        if (stateRef.column === column) {
            stateRef.direction = stateRef.direction === "asc" ? "desc" : "asc";
        } else {
            stateRef.column = column;
            stateRef.direction = "asc";
        }

        if (tableType === "team") {
            renderTeams();
        } else {
            renderPlayers();
        }
    }

    function updateSortIndicators(tableType) {
        const headers = tableType === "team" ? dom.teamTableHeaders : dom.playerTableHeaders;
        const { column, direction } = sortState[tableType];
        if (!headers || typeof headers.forEach !== 'function') return;

        headers.forEach(th => {
            th.classList.remove("sorted-asc", "sorted-desc");
            const thCol = th.getAttribute("data-col");
            if (thCol && thCol === column) {
                th.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
            }
        });
    }

    function sortTeamsList(teams) {
        const { column, direction } = sortState.team;
        if (!column) return [...teams];

        return [...teams].sort((a, b) => compareValues(
            getTeamSortValue(a, column),
            getTeamSortValue(b, column),
            direction
        ));
    }

    function getTeamSortValue(team, column) {
        switch (column) {
            case "name":
                return (team.name || "").toLowerCase();
            case "eliminated":
                return team.eliminated ? 1 : 0;
            default:
                return team[column];
        }
    }

    function sortPlayersList(players) {
        const { column, direction } = sortState.player;
        if (!column) return [...players];

        return [...players].sort((a, b) => compareValues(
            getPlayerSortValue(a, column),
            getPlayerSortValue(b, column),
            direction
        ));
    }

    function getPlayerSortValue(player, column) {
        switch (column) {
            case "name":
                return (player.name || "").toLowerCase();
            case "status":
                return simplifyStatus(player.status).toLowerCase();
            case "last_action":
                if (player.last_action && player.last_action.timestamp !== undefined) {
                    return player.last_action.timestamp;
                }
                return player.last_action?.relative || null;
            case "bs_estimate_human":
                return parseBattlestatValue(player.bs_estimate_human);
            case "fair_fight":
                return parseFairFightValue(player.fair_fight);
            case "id":
            case "level":
            case "attacks":
                return Number(player[column]);
            default:
                return player[column];
        }
    }

    function parseBattlestatValue(value) {
        if (value === undefined || value === null || value === "--") return null;
        if (typeof value === "number") return value;
        if (typeof value !== "string") return value;

        const cleaned = value.replace(/,/g, "").trim();
        const lower = cleaned.toLowerCase();
        let multiplier = 1;

        if (lower.endsWith("b")) multiplier = 1e9;
        else if (lower.endsWith("m")) multiplier = 1e6;
        else if (lower.endsWith("k")) multiplier = 1e3;

        const numeric = parseFloat(cleaned);
        if (Number.isNaN(numeric)) return lower;
        return numeric * multiplier;
    }

    function parseFairFightValue(value) {
        if (value === undefined || value === null || value === "--") return null;
        if (typeof value === "number") return Number.isNaN(value) ? null : value;

        const numeric = Number(value);
        if (Number.isNaN(numeric)) return null;
        return numeric;
    }

    function deriveFairFightValue(player) {
        return parseFairFightValue(player?.fair_fight);
    }

    function deriveBsEstimateNumber(player) {
        const parsedDirect = parseBattlestatValue(player?.bs_estimate);
        if (typeof parsedDirect === "number" && !Number.isNaN(parsedDirect)) {
            return parsedDirect;
        }

        const parsedHuman = parseBattlestatValue(player?.bs_estimate_human);
        if (typeof parsedHuman === "number" && !Number.isNaN(parsedHuman)) {
            return parsedHuman;
        }

        return null;
    }

    function getBattlestatsFairFightColorClass(fairFightValue) {
        if (fairFightValue === null || fairFightValue === undefined || Number.isNaN(fairFightValue)) {
            return "";
        }

        if (fairFightValue >= 0 && fairFightValue < 2.5) {
            return "state-blue";
        }

        if (fairFightValue >= 2.5 && fairFightValue < 3.6) {
            return "state-green";
        }

        if (fairFightValue >= 3.6) {
            return "state-red";
        }

        return "";
    }

    function compareValues(a, b, direction) {
        const multiplier = direction === "asc" ? 1 : -1;

        if (a === b) return 0;
        if (a === null || a === undefined) return 1;
        if (b === null || b === undefined) return -1;

        const aNum = typeof a === "number" ? a : Number(a);
        const bNum = typeof b === "number" ? b : Number(b);
        const aIsNum = !Number.isNaN(aNum);
        const bIsNum = !Number.isNaN(bNum);

        if (aIsNum && bIsNum) {
            if (aNum === bNum) return 0;
            return aNum > bNum ? multiplier : -multiplier;
        }

        const aStr = a.toString();
        const bStr = b.toString();
        return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" }) * multiplier;
    }

    function formatTeamValue(value) {
        if (value === undefined || value === null || value === "") return "--";
        return value;
    }

    function renderTeams() {
        if (!dom.teamTableBody) return; // team table removed from DOM
        ensureValidSelectedTeam();
        const selected = state.selectedTeamId;
        const selectedNormalized = normalizeTeamId(selected);
        dom.teamTableBody.innerHTML = "";

        // If a faction is configured, show only that Faction as the single managed entry
        if (state.factionId) {
            const teamKey = `faction:${state.factionId}`;
            const name = (state.factionCache && state.factionCache[String(state.factionId)] && state.factionCache[String(state.factionId)].data && state.factionCache[String(state.factionId)].data.name) || `Faction ${state.factionId}`;
            const participants = (state.teamPlayers[teamKey] || []).length || "--";
            const row = document.createElement("tr");
            if (normalizeTeamId(teamKey) === selectedNormalized) row.classList.add("selected-row");
            row.innerHTML = `
                <td>${teamKey}</td>
                <td>${name}</td>
                <td>${formatTeamValue(participants)}</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
            `;
            row.addEventListener("click", () => handleTeamSelect(teamKey));
            dom.teamTableBody.appendChild(row);
            updateSortIndicators("team");
            return;
        }

        const teams = sortTeamsList(getVisibleTeams(state.teams));

        for (const t of teams) {
            const row = document.createElement("tr");
            if (normalizeTeamId(t.id) === selectedNormalized) row.classList.add("selected-row");
            if (t.eliminated === true) row.classList.add("eliminated-row");

            row.innerHTML = `
                <td>${t.id}</td>
                <td>${t.name}</td>
                <td>${formatTeamValue(t.participants)}</td>
                <td>${formatTeamValue(t.score)}</td>
                <td>${formatTeamValue(t.wins)}</td>
                <td>${formatTeamValue(t.losses)}</td>
                <td>${formatTeamValue(t.lives)}</td>
                <td>${formatTeamValue(t.position)}</td>
                <td>${formatTeamValue(t.eliminated)}</td>
            `;

            row.addEventListener("click", () => handleTeamSelect(t.id));
            dom.teamTableBody.appendChild(row);
        }

        updateSortIndicators("team");
    }

    async function handleTeamSelect(teamId) {
        state.saveSelectedTeamId(teamId);
        state.selectedPlayersByTeam[teamId] = state.selectedPlayersByTeam[teamId] || null;
        renderTeams();
        renderPlayers();
        await refreshTeamPlayers(false);
    }

    function handlePlayerSelect(teamId, playerId) {
        const currentSelected = state.selectedPlayersByTeam[teamId];
        state.selectedPlayersByTeam[teamId] = currentSelected === playerId ? null : playerId;
        renderPlayers();
    }

    function handleClaimToggle(teamId, playerId, claimed) {
        state.setPlayerClaimed(teamId, playerId, claimed);
        renderPlayers();
    }

    async function refreshTeamPlayers(force = false) {
        const teamId = state.selectedTeamId;
        if (!teamId) return;
        // Only faction-backed team keys are supported in this assistant.
        if (typeof teamId === 'string' && teamId.startsWith('faction:')) {
            const factionId = teamId.split(':')[1];
            await fetchAndCacheFactionMembers(factionId, force);
            renderPlayers();
        }
    }

    async function maybeLoadStaticTeamPlayers(teamId) {
        // static snapshot removed — do not attempt to load from bundled file
        return false;
    }

    async function fetchAndCacheFactionMembers(factionId, force = false) {
        if (!factionId) return;
        const teamKey = `faction:${factionId}`;

        const ttl = state.TEAM_REFRESH_MS || (state.refreshPeriodSeconds || 30) * 1000;
        if (!force) {
            const cached = state.getCachedFaction(factionId, ttl);
            if (cached && Array.isArray(cached.members) && cached.members.length) {
                        let players = cached.members.map(m => ensurePlayerDefaults({ id: (m.player_id ?? m.id), name: m.name, level: m.level, status: m.status || { state: 'Okay' }, last_action: m.last_action || {}, rawData: m }));
                        players = preserveCachedBattleStats(teamKey, players);
                        await maybeFetchFfScouterStats(players);
                        state.cacheTeamPlayers(teamKey, players);
                if (dom.playersTitle) {
                    const name = cached.name || `Faction ${factionId}`;
                    dom.playersTitle.textContent = `${name} [${factionId}]`;
                }
                if (dom.teamLastRun) {
                    const ts = state.teamPlayersTimestamp[teamKey];
                    if (ts) {
                        try { dom.teamLastRun.textContent = `Last: ${new Date(ts).toLocaleTimeString()}`; } catch (e) {}
                    }
                }
                return;
            }
        }

        if (!state.apikey) return;

        const data = await api.getFaction(factionId, state.apikey);
        if (data.error) {
            console.error('Faction lookup error', data.error);
            return;
        }

        const faction = data.faction || data || {};

        // Faction name can appear in several shapes depending on the API response.
        const resolvedName = faction.name || faction.basic?.name || data.name || data.basic?.name || `Faction ${factionId}`;

        const membersRaw = Array.isArray(faction.members)
            ? faction.members
            : Array.isArray(faction?.members?.members)
                ? faction.members.members
                : Array.isArray(data.members) ? data.members : [];

        let players = (membersRaw || []).map(m => ensurePlayerDefaults({ id: (m.player_id ?? m.id), name: m.name, level: m.level, status: m.status || { state: 'Okay' }, last_action: m.last_action || {}, rawData: m }));

        // Merge previously cached battlestats so we don't drop them on refresh
        players = preserveCachedBattleStats(teamKey, players);
        await maybeFetchFfScouterStats(players);

        // Cache the faction data with a normalized name field to simplify later reads
        const factionToCache = { ...faction, name: resolvedName };
        state.cacheFactionData(factionId, factionToCache);
        state.cacheTeamPlayers(teamKey, players);

        if (dom.teamLastRun) {
            const ts = state.teamPlayersTimestamp[teamKey];
            if (ts) {
                try { dom.teamLastRun.textContent = `Last: ${new Date(ts).toLocaleTimeString()}`; } catch (e) {}
            }
        }

        // Replace any existing teams metadata with only this faction (app manages a single faction)
        state.teams = [{ id: teamKey, name: resolvedName, participants: players.length }];
        state.cacheMetadata(state.user, state.teams);
        if (dom.playersTitle) dom.playersTitle.textContent = `${resolvedName} [${factionId}]`;
    }

    function applyFilters(players) {
        const levelMin = parseInt(dom.levelMinInput.value || 0, 10);
        const levelMax = parseInt(dom.levelMaxInput.value || 100, 10);
        const bsMinInputVal = dom.bsMinInput.value.trim();
        const bsMaxInputVal = dom.bsMaxInput.value.trim();
        const bsMin = parseBattlestatValue(bsMinInputVal);
        const bsMax = parseBattlestatValue(bsMaxInputVal);
        const fairFightMinInputVal = dom.fairFightMinInput.value.trim();
        const fairFightMaxInputVal = dom.fairFightMaxInput.value.trim();
        const fairFightMin = parseFairFightValue(fairFightMinInputVal);
        const fairFightMax = parseFairFightValue(fairFightMaxInputVal);
        const okayOnly = dom.filterOkayOnly.checked;
        const locationSelection = dom.locationFilter.value;

        const hasBsMin = bsMinInputVal !== "" && typeof bsMin === "number" && !Number.isNaN(bsMin);
        const hasBsMax = bsMaxInputVal !== "" && typeof bsMax === "number" && !Number.isNaN(bsMax);
        const hasFairFightMin = fairFightMinInputVal !== "" && typeof fairFightMin === "number" && !Number.isNaN(fairFightMin);
        const hasFairFightMax = fairFightMaxInputVal !== "" && typeof fairFightMax === "number" && !Number.isNaN(fairFightMax);

        return players.filter(p => {
            const statusText = simplifyStatus(p.status);
            const playerLocation = p.location;
            if (p.level < levelMin || p.level > levelMax) return false;
            const bsValue = typeof p.bs_estimate === "number" ? p.bs_estimate : parseBattlestatValue(p.bs_estimate);
            const bsIsNumber = typeof bsValue === "number" && !Number.isNaN(bsValue);
            if (hasBsMin && (!bsIsNumber || bsValue < bsMin)) return false;
            if (hasBsMax && (!bsIsNumber || bsValue > bsMax)) return false;
            const fairFightValue = parseFairFightValue(p.fair_fight);
            const fairFightIsNumber = typeof fairFightValue === "number" && !Number.isNaN(fairFightValue);
            if (hasFairFightMin && (!fairFightIsNumber || fairFightValue < fairFightMin)) return false;
            if (hasFairFightMax && (!fairFightIsNumber || fairFightValue > fairFightMax)) return false;
            if (okayOnly) {
                const isOkayStatus = statusText === "Okay" || statusText.startsWith("In ");
                const isHospital = p.status?.state === "Hospital";
                if (!isOkayStatus || isHospital) return false;
            }
            if (locationSelection === "all") return true;

            if (locationSelection === "torn") {
                return playerLocation === LOCATION.TORN || (!playerLocation && st !== "Traveling" && st !== "Abroad");
            }

            if (locationSelection === "abroad") {
                return playerLocation && playerLocation !== LOCATION.TORN && !playerLocation.startsWith("Traveling ");
            }

            if (locationSelection === "traveling") {
                return typeof playerLocation === "string" && playerLocation.startsWith("Traveling ");
            }

            return playerLocation === locationSelection;
        });
    }

    function updateLocationFilterOptions(players) {
        const destinations = new Set();
        const travelingDestinations = new Set();

        players.forEach(p => {
            const loc = p.location;
            if (!loc || loc === LOCATION.TORN) return;
            if (loc.startsWith("Traveling ")) {
                travelingDestinations.add(loc);
            } else {
                destinations.add(loc);
            }
        });

        const previous = dom.locationFilter.value || "all";
        dom.locationFilter.innerHTML = "";

        const baseOptions = [
            { value: "all", label: "All" },
            { value: "torn", label: "Torn" },
            { value: "abroad", label: "Abroad (not in Torn)" },
            { value: "traveling", label: "Traveling" }
        ];

        const validValues = new Set();

        baseOptions.forEach(({ value, label }) => {
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = label;
            dom.locationFilter.appendChild(opt);
            validValues.add(value);
        });

        Array.from(destinations)
            .sort((a, b) => a.localeCompare(b))
            .forEach(dest => {
                const opt = document.createElement("option");
                opt.value = dest;
                opt.textContent = dest;
                dom.locationFilter.appendChild(opt);
                validValues.add(dest);
            });

        Array.from(travelingDestinations)
            .sort((a, b) => a.localeCompare(b))
            .forEach(dest => {
                const opt = document.createElement("option");
                opt.value = dest;
                opt.textContent = dest;
                dom.locationFilter.appendChild(opt);
                validValues.add(dest);
            });

        if (validValues.has(previous)) {
            dom.locationFilter.value = previous;
        }
    }

    function renderPlayers() {
        const teamId = state.selectedTeamId;
        if (!teamId) {
            dom.playerTableBody.innerHTML = "";
            updateSortIndicators("player");
            return;
        }

        const players = (state.teamPlayers[teamId] || []).map(ensurePlayerDefaults);
        state.teamPlayers[teamId] = players;

        const selectedPlayerId = state.selectedPlayersByTeam[teamId] || null;

        updateLocationFilterOptions(players);
        const filtered = applyFilters(players);
        const sortedPlayers = sortPlayersList(filtered);

        const scrollContainer = dom.playerTableBody.parentElement;
        const prevScroll = scrollContainer ? scrollContainer.scrollTop : 0;

        dom.playerTableBody.innerHTML = "";

        const nowSec = Math.floor(Date.now() / 1000);

        for (const p of sortedPlayers) {
            const row = document.createElement("tr");
            const baseStatusText = simplifyStatus(p.status);
            const hospitalUntil = p.status.until;
            let statusClass = mapStateColor(p.status.state);
            let statusCellContent = baseStatusText;

            if (p.status.state === "Hospital" && hospitalUntil) {
                const remaining = hospitalUntil - nowSec;
                const countdownText = formatHMS(Math.max(0, remaining));
                statusClass = getHospitalCountdownClass(remaining);
                const loc = extractHospitalLocation(p.status);
                statusCellContent = `In hospital (${loc}) for <span class="countdown" data-until="${hospitalUntil}">${countdownText}</span>`;
            }

            const attackUrl = `https://www.torn.com/loader.php?sid=attack&user2ID=${p.id}`;

            // Render last action as minutes:seconds, include hours when > 60 minutes,
            // and color-code the text: green (<15m), red (>1h), default otherwise.
            let lastActionDisplayText = p.last_action?.relative ?? "--";
            let lastActionClass = "";
            if (p.last_action && p.last_action.timestamp) {
                const delta = Math.max(0, nowSec - Number(p.last_action.timestamp));
                const hours = Math.floor(delta / 3600);
                const mins = Math.floor((delta % 3600) / 60);
                const secs = delta % 60;
                if (hours > 0) {
                    lastActionDisplayText = `${hours}h ${mins}m ${secs}s`;
                } else {
                    lastActionDisplayText = `${mins}m ${secs}s`;
                }

                if (delta < 15 * 60) {
                    lastActionClass = "state-green";
                } else if (delta > 60 * 60) {
                    lastActionClass = "state-red";
                } else {
                    lastActionClass = "";
                }
            }

            const isClaimed = state.isPlayerClaimed(teamId, p.id);
            if (isClaimed) row.classList.add("claimed-row");

            const fairFightValue = parseFairFightValue(p.fair_fight);
            const battlestatsColorClass = getBattlestatsFairFightColorClass(fairFightValue);

            row.innerHTML = `
                <td><a href="https://www.torn.com/profiles.php?XID=${p.id}" target="_blank" rel="noopener noreferrer">${p.id}</a></td>
                <td><a href="https://www.torn.com/profiles.php?XID=${p.id}" target="_blank" rel="noopener noreferrer">${p.name}</a></td>
                <td>${p.level}</td>
                <td class="status-cell ${statusClass}">${statusCellContent}</td>
                <td><span class="${lastActionClass}">${lastActionDisplayText}</span></td>
                <td>${p.fair_fight ?? "--"}</td>
                <td class="${battlestatsColorClass}"><a href="${attackUrl}" target="_blank" rel="noopener noreferrer">${p.bs_estimate_human || "--"} ⚔</a></td>
                <td class="claimed-cell"><input type="checkbox" class="claimed-checkbox" ${isClaimed ? "checked" : ""} aria-label="Mark ${p.name} as claimed"></td>
            `;

            const rawCell = document.createElement("td");
            rawCell.classList.add("hidden", "raw-data-cell");
            rawCell.textContent = JSON.stringify(p.rawData || {}, null, 0);
            row.appendChild(rawCell);

            const claimCheckbox = row.querySelector(".claimed-checkbox");
            if (claimCheckbox) {
                claimCheckbox.addEventListener("click", event => event.stopPropagation());
                claimCheckbox.addEventListener("change", event => {
                    handleClaimToggle(teamId, p.id, event.target.checked);
                });
            }

            if (selectedPlayerId === p.id) row.classList.add("selected-row");
            row.addEventListener("click", () => handlePlayerSelect(teamId, p.id));

            dom.playerTableBody.appendChild(row);
        }

        if (scrollContainer) scrollContainer.scrollTop = prevScroll;
        startCountdownUpdater();
        updateSortIndicators("player");
    }

    function startCountdownUpdater() {
        if (intervals.countdown) clearInterval(intervals.countdown);
        intervals.countdown = setInterval(() => {
            document.querySelectorAll(".countdown[data-until]").forEach(el => {
                const untilSec = parseInt(el.getAttribute("data-until"), 10);
                const nowSec = Math.floor(Date.now() / 1000);
                const remaining = untilSec - nowSec;
                const cell = el.closest(".status-cell");

                if (remaining <= 0) {
                    if (cell) {
                        cell.textContent = "Okay";
                        cell.className = "status-cell state-green";
                    }
                    el.removeAttribute("data-until");
                    return;
                }

                const colorClass = getHospitalCountdownClass(remaining);
                el.textContent = formatHMS(remaining);
                if (cell) cell.className = `status-cell ${colorClass}`;
            });
        }, 1000);
    }

    function formatHMS(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function getHospitalCountdownClass(remaining) {
        if (remaining < 10) return "state-red";
        if (remaining < 60) return "state-orange";
        return "state-yellow";
    }

    function mapStateColor(stateValue) {
        switch (stateValue) {
            case "Hospital": return "state-orange";
            case "Traveling": return "state-blue";
            case "Abroad": return "state-blue";
            case "Okay": return "state-green";
            default: return "";
        }
    }

    function attachFilterListeners() {
        dom.levelMinInput.addEventListener("input", renderPlayers);
        dom.levelMaxInput.addEventListener("input", renderPlayers);
        dom.bsMinInput.addEventListener("input", renderPlayers);
        dom.bsMaxInput.addEventListener("input", renderPlayers);
        dom.fairFightMinInput.addEventListener("input", renderPlayers);
        dom.fairFightMaxInput.addEventListener("input", renderPlayers);
        dom.filterOkayOnly.addEventListener("change", renderPlayers);
        dom.locationFilter.addEventListener("change", renderPlayers);
    }

    function startMetadataCountdown() {
        if (intervals.metadata) clearInterval(intervals.metadata);
        intervals.metadata = setInterval(() => {
            const remaining = state.METADATA_REFRESH_MS - (Date.now() - state.metadataTimestamp);
            dom.metadataTimerLabel.textContent = `Next refresh: ${Math.max(0, Math.floor(remaining / 1000))}s`;
            if (remaining <= 0) refreshMetadata();
        }, 1000);
    }

    function startTeamCountdown() {
        if (intervals.team) clearInterval(intervals.team);
        intervals.team = setInterval(() => {
            const teamId = state.selectedTeamId;
            if (!teamId) {
                dom.teamTimerLabel.textContent = "Next refresh: --";
                return;
            }
            const last = state.teamPlayersTimestamp[teamId] || 0;
            const remaining = state.TEAM_REFRESH_MS - (Date.now() - last);
            dom.teamTimerLabel.textContent = `Next refresh: ${Math.max(0, Math.floor(remaining / 1000))}s`;
            if (remaining <= 0 && isTeamSectionVisible()) refreshTeamPlayers();
        }, 1000);
    }

    function isTeamSectionVisible() {
        return !dom.playerTableBody.closest("section").classList.contains("hidden");
    }


    async function loadFfDefaultsConfig() {
        try {
            const resp = await fetch('ffscouter_defaults.json', { cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const payload = await resp.json();
            const factionId = Number(payload && payload.faction_id);
            if (!Number.isNaN(factionId) && factionId > 0) {
                state.saveFactionId(factionId);
                const teamKey = `faction:${factionId}`;
                state.saveSelectedTeamId(teamKey);
            }
        } catch (err) {
            console.warn('Failed to load ffscouter defaults', err);
        }
    }

    window.app = {
        init,
        simplifyStatus,
        mapStateColor,
        formatHMS,
        applyFilters,
        getHospitalCountdownClass,
        renderPlayers
    };

    (async () => {
        await loadFfDefaultsConfig();
        init();
    })();
})();
