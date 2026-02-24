// State management for Torn War Intel
// All app data is accessed via state.js

class AppState {
    constructor() {
        this.ffDefaults = null;
        this.players = null; // in-memory cache
    }

    async loadFfDefaults() {
        // Always use window.FFSCOUTER_DEFAULTS (script import)
        if (window.FFSCOUTER_DEFAULTS) {
            this.ffDefaults = window.FFSCOUTER_DEFAULTS;
            // Transform data: { id: bs } => { id, bs_estimate_human }
            this.players = {};
            for (var id in this.ffDefaults.data) {
                if (this.ffDefaults.data.hasOwnProperty(id)) {
                    this.players[id] = {
                        id: id,
                        bs_estimate_human: this.ffDefaults.data[id]
                    };
                }
            }
        } else {
            this.ffDefaults = { data: {}, faction_id: null, faction_name: null };
            this.players = {};
        }
    }

    getFactionId() {
        return (this.ffDefaults && this.ffDefaults.faction_id) ? this.ffDefaults.faction_id : null;
    }

    getFactionName() {
        return (this.ffDefaults && this.ffDefaults.faction_name) ? this.ffDefaults.faction_name : null;
    }

    getPlayers() {
        // If no players in memory, try to populate from ffDefaults
        if (!this.players || Object.keys(this.players).length === 0) {
            if (this.ffDefaults && this.ffDefaults.data) {
                this.players = this.ffDefaults.data;
            }
        }
        return this.players || {};
    }

    getState() {
        // Returns app state from localStorage
        const stored = localStorage.getItem("tornwarintel_state");
        let state = {};
        if (stored) {
            try {
                state = JSON.parse(stored);
            } catch (e) {
                state = {};
            }
        }
        // Always pull apikey separately
        const apikey = localStorage.getItem("tornwarintel_apikey");
        if (apikey) state.apikey = apikey;
        return state;
    }

    setState(newState) {
        // Save everything except apikey
        const { apikey, ...toStore } = newState;
        localStorage.setItem("tornwarintel_state", JSON.stringify(toStore));
        if (apikey) {
            localStorage.setItem("tornwarintel_apikey", apikey);
        } else {
            localStorage.removeItem("tornwarintel_apikey");
        }
    }

    setApiKey(newKey) {
        localStorage.setItem("tornwarintel_apikey", newKey);
    }

    clearState() {
        localStorage.removeItem("tornwarintel_state");
        localStorage.removeItem("tornwarintel_apikey");
    }

    updatePlayersFromApi(apiPlayers) {
        // Update ffDefaults.data with new API player data
        if (!this.ffDefaults) return;
        // Assume apiPlayers is an array of player objects
        const playerMap = {};
        apiPlayers.forEach(p => {
            const id = p.id || p.player_id || p.user_id;
            if (id) playerMap[id] = p;
        });
        this.ffDefaults.data = playerMap;
    }
}

window.AppState = AppState;
