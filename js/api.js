window.api = {
    BASE: "https://api.torn.com/v2",
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
    }
};
