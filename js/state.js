window.state = {
    apikey: "",
    rememberApiKey: false,
    factionId: null,
    teamRefreshPeriodSeconds: 10,
    user: null,
    teams: [],
    selectedTeamId: null,
    selectedPlayersByTeam: {},
    claimedPlayersByTeam: {},

    hidePinkPowerTeam: false,

    teamPlayers: {},
    teamPlayersTimestamp: {},
    factionCache: {},

    TEAM_REFRESH_MS: 10000,
    MIN_TEAM_REFRESH_MS: 1000,

    normalizeTeamRefreshPeriod(seconds) {
        const parsed = Number(seconds);
        if (!Number.isFinite(parsed) || parsed <= 0) return 10;
        return Math.max(1, Math.round(parsed));
    },

    loadFromStorage() {
        try {
            const claimedPlayersRaw = localStorage.getItem("claimedPlayersByTeam");
            this.claimedPlayersByTeam = claimedPlayersRaw ? JSON.parse(claimedPlayersRaw) : {};
        } catch (err) {
            this.claimedPlayersByTeam = {};
        }

        const rememberApiKeyRaw = localStorage.getItem("rememberApiKey");
        this.rememberApiKey = rememberApiKeyRaw === "true";

        this.apikey = this.rememberApiKey ? (localStorage.getItem("apikey") || "") : "";

        if (!this.apikey) {
            this.clearCachedData();
            return;
        }
        try {
            const userRaw = localStorage.getItem("user");
            const teamsRaw = localStorage.getItem("teams");
            const playersRaw = localStorage.getItem("teamPlayers");
            const playerTimestampsRaw = localStorage.getItem("teamPlayersTimestamp");
            const selectedTeamRaw = localStorage.getItem("selectedTeamId");
            const factionIdRaw = localStorage.getItem("factionId");
            const teamRefreshSecondsRaw = localStorage.getItem("teamRefreshPeriodSeconds") || localStorage.getItem("refreshPeriodSeconds");

            this.user = userRaw ? JSON.parse(userRaw) : null;
            this.teams = teamsRaw ? JSON.parse(teamsRaw) : [];
            this.teamPlayers = playersRaw ? JSON.parse(playersRaw) : {};
            this.teamPlayersTimestamp = playerTimestampsRaw ? JSON.parse(playerTimestampsRaw) : {};
            const factionCacheRaw = localStorage.getItem("factionCache");
            this.factionCache = factionCacheRaw ? JSON.parse(factionCacheRaw) : {};
            this.selectedTeamId = selectedTeamRaw || null;
            this.factionId = factionIdRaw ? (Number.isNaN(Number(factionIdRaw)) ? null : parseInt(factionIdRaw, 10)) : null;
            this.teamRefreshPeriodSeconds = this.normalizeTeamRefreshPeriod(
                teamRefreshSecondsRaw ?? this.teamRefreshPeriodSeconds
            );
            // apply refresh period to ms settings
            this.TEAM_REFRESH_MS = this.teamRefreshPeriodSeconds * 1000;
            this.MIN_TEAM_REFRESH_MS = 1000;
            localStorage.removeItem("hidePinkPowerTeam");
            localStorage.removeItem("ffapikey");
            localStorage.removeItem("rememberFfApiKey");
            localStorage.removeItem("metadataRefreshPeriodSeconds");
            localStorage.removeItem("metadataTimestamp");
            this.hidePinkPowerTeam = false;
        } catch (err) {
            console.error("Failed to restore cached state", err);
            this.clearCachedData();
        }
    },

    saveApiKey(key, rememberKey = false) {
        this.apikey = key;
        this.rememberApiKey = rememberKey;
        localStorage.setItem("rememberApiKey", rememberKey ? "true" : "false");
        if (rememberKey) {
            localStorage.setItem("apikey", key);
        } else {
            localStorage.removeItem("apikey");
        }
    },

    saveFactionId(id) {
        this.factionId = id === null || id === undefined ? null : Number(id);
        if (this.factionId === null) {
            localStorage.removeItem("factionId");
        } else {
            localStorage.setItem("factionId", String(this.factionId));
        }
    },

    saveTeamRefreshPeriod(seconds) {
        const sec = this.normalizeTeamRefreshPeriod(seconds);
        this.teamRefreshPeriodSeconds = sec;
        localStorage.setItem("teamRefreshPeriodSeconds", String(sec));
        localStorage.removeItem("refreshPeriodSeconds");
        this.TEAM_REFRESH_MS = sec * 1000;
        this.MIN_TEAM_REFRESH_MS = 1000;
        return sec;
    },

    clearCachedData() {
        this.user = null;
        this.teams = [];
        this.teamPlayers = {};
        this.teamPlayersTimestamp = {};
        this.selectedTeamId = null;
        this.hidePinkPowerTeam = false;

        localStorage.removeItem("user");
        localStorage.removeItem("teams");
        localStorage.removeItem("teamPlayers");
        localStorage.removeItem("teamPlayersTimestamp");
        localStorage.removeItem("selectedTeamId");
        localStorage.removeItem("hidePinkPowerTeam");
        localStorage.removeItem("ffapikey");
        localStorage.removeItem("rememberFfApiKey");
    },

    setPlayerClaimed(teamId, playerId, claimed) {
        if (teamId === null || teamId === undefined || playerId === null || playerId === undefined) return;

        const teamKey = String(teamId);
        const playerKey = String(playerId);
        this.claimedPlayersByTeam = this.claimedPlayersByTeam || {};
        this.claimedPlayersByTeam[teamKey] = this.claimedPlayersByTeam[teamKey] || {};

        if (claimed) {
            this.claimedPlayersByTeam[teamKey][playerKey] = true;
        } else if (this.claimedPlayersByTeam[teamKey]) {
            delete this.claimedPlayersByTeam[teamKey][playerKey];
            if (Object.keys(this.claimedPlayersByTeam[teamKey]).length === 0) {
                delete this.claimedPlayersByTeam[teamKey];
            }
        }

        localStorage.setItem("claimedPlayersByTeam", JSON.stringify(this.claimedPlayersByTeam));
    },

    isPlayerClaimed(teamId, playerId) {
        if (teamId === null || teamId === undefined || playerId === null || playerId === undefined) return false;
        const teamKey = String(teamId);
        const playerKey = String(playerId);
        return Boolean(this.claimedPlayersByTeam?.[teamKey]?.[playerKey]);
    },

    clearApiKey() {
        this.apikey = "";
        this.rememberApiKey = false;
        localStorage.removeItem("apikey");
        localStorage.setItem("rememberApiKey", "false");
    },
    cacheMetadata(user, teams) {
        this.user = user;
        // If a factionId is set, persist only that single faction as the managed "team"
        if (this.factionId) {
            const teamKey = `faction:${this.factionId}`;
            const players = Array.isArray(this.teamPlayers?.[teamKey]) ? this.teamPlayers[teamKey] : [];
            const cachedName = (this.factionCache && this.factionCache[String(this.factionId)] && this.factionCache[String(this.factionId)].data && this.factionCache[String(this.factionId)].data.name) || `Faction ${this.factionId}`;
            this.teams = [{ id: teamKey, name: cachedName, participants: players.length }];
        } else {
            this.teams = teams;
        }

        localStorage.setItem("user", JSON.stringify(user || null));
        localStorage.setItem("teams", JSON.stringify(this.teams || []));
    },

    saveSelectedTeamId(teamId) {
        this.selectedTeamId = teamId;
        if (teamId === null || teamId === undefined) {
            localStorage.removeItem("selectedTeamId");
            return;
        }
        localStorage.setItem("selectedTeamId", teamId.toString());
    },

    hidePinkPowerPermanently() {
        this.hidePinkPowerTeam = false;
        localStorage.removeItem("hidePinkPowerTeam");
        localStorage.removeItem("ffapikey");
        localStorage.removeItem("rememberFfApiKey");
    },

    cacheTeamPlayers(teamId, players) {
        this.teamPlayers[teamId] = players;
        this.teamPlayersTimestamp[teamId] = Date.now();

        try {
            // Persist the full player objects (including rawData) so the original
            // faction/member payload is available for inspection and debugging.
            localStorage.setItem("teamPlayers", JSON.stringify(this.teamPlayers));
            localStorage.setItem("teamPlayersTimestamp", JSON.stringify(this.teamPlayersTimestamp));
        } catch (err) {
            console.warn("Failed to persist team players", err);
        }
    },

    cacheFactionData(factionId, data) {
        try {
            if (!factionId) return;
            this.factionCache = this.factionCache || {};
            this.factionCache[String(factionId)] = { ts: Date.now(), data };
            localStorage.setItem("factionCache", JSON.stringify(this.factionCache));
        } catch (err) {
            console.warn("Failed to cache faction data", err);
        }
    },

    getCachedFaction(factionId, maxAgeMs = null) {
        try {
            if (!factionId) return null;
            const entry = (this.factionCache || {})[String(factionId)];
            if (!entry) return null;
            if (maxAgeMs && Date.now() - (entry.ts || 0) > maxAgeMs) return null;
            return entry.data || null;
        } catch (err) {
            return null;
        }
    },

    shouldRefreshTeam(teamId, now = Date.now()) {
        const last = this.teamPlayersTimestamp[teamId] || 0;
        if (now - last < this.MIN_TEAM_REFRESH_MS) return false;
        return now - last >= this.TEAM_REFRESH_MS;
    }
};

// legacy handle
window.AppState = window.state;
