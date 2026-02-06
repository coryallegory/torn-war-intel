window.api = {
    BASE: "https://api.torn.com/v2",
    FF_BASE: "https://ffscouter.com/api/v1",
    async request(url, apikey) {
        try {
            const headers = { Accept: "application/json" };
            if (apikey) headers.Authorization = `ApiKey ${apikey}`;
            const res = await fetch(url, { headers });
            const data = await res.json();

            if (data && data.error) {
                console.error("API Error:", data.error);
                return { error: data.error };
            }

            return data;
        } catch (err) {
            console.error("Network/API exception:", err);
            return { error: { code: -1, error: "Network error" } };
        }
    },

    getUser(apikey) {
        return this.request(`${this.BASE}/user/basic?striptags=true`, apikey);
    },

    getFaction(factionId, apikey) {
        if (!factionId) return Promise.resolve({ error: { error: 'No faction id' } });
        return this.request(`${this.BASE}/faction/${encodeURIComponent(factionId)}?selections=basic,members`, apikey);
    },

    async requestFf(url) {
        try {
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            const data = await res.json();
            if (data && data.error) console.error("FFScouter API Error:", data.error);
            return data;
        } catch (err) {
            console.error("FFScouter network/API exception:", err);
            return { error: { code: -1, error: "Network error" } };
        }
    },

    checkFfKey(key) {
        return this.requestFf(`${this.FF_BASE}/check-key?key=${encodeURIComponent(key)}`);
    },

    getFfStats(key, playerIdsCsv) {
        return this.requestFf(`${this.FF_BASE}/get-stats?key=${encodeURIComponent(key)}&targets=${playerIdsCsv}`);
    }
};

// legacy handle (kept for compatibility)
window.TornAPI = window.api;
