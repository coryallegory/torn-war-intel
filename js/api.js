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
    },

    // Additional API logic for Torn War Intel
    maybeFetchFfScouterStats(players, ffDefaults) {
        return new Promise((resolve) => {
            if (!players || !players.length) resolve();
            if (!ffDefaults || !ffDefaults.data) resolve();
            players.forEach(p => {
                const playerId = this.getPlayerIdentifier(p);
                if (playerId === null || playerId === undefined) return;
                const key = String(Number(playerId));
                const ffData = ffDefaults.data.get(key) ?? ffDefaults.data.get(String(playerId));
                if (ffData !== undefined) {
                    let ffObj = typeof ffData === "object" ? ffData : { bs_estimate_human: ffData };
                    const updated = updateFromFFScouterAPIData(p, ffObj);
                    Object.assign(p, updated);
                }
            });
            resolve();
        });
    },

    loadFfDefaults(ffDefaults) {
        return new Promise(async (resolve) => {
            try {
                const res = await fetch('ffscouter_defaults.json', { cache: 'no-cache' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const obj = await res.json();
                ffDefaults.faction_id = obj.faction_id ?? obj.factionId ?? null;
                ffDefaults.faction_name = (obj.faction_name ?? obj.factionName ?? obj.faction) || null;
                const raw = obj.data ?? obj.byId ?? obj.results ?? {};
                const m = new Map();
                if (Array.isArray(raw)) {
                    raw.forEach(e => {
                        const pid = e.player_id ?? e.playerId ?? e.id ?? e.user_id ?? e.userId;
                        const bs = e.bs_estimate_human ?? e.bs_estimate ?? e.bs;
                        if (pid !== undefined && bs !== undefined) m.set(String(pid), bs);
                    });
                } else if (raw && typeof raw === 'object') {
                    Object.entries(raw).forEach(([k, v]) => {
                        m.set(String(k), v);
                    });
                }
                ffDefaults.data = m;
                console.log('Loaded ffscouter defaults:', m.size, 'entries');
            } catch (err) {
                console.warn('Unable to load ffscouter_defaults.json', err);
                ffDefaults = { data: new Map(), faction_id: null, faction_name: null };
            }
            resolve();
        });
    },

    fetchAndCacheFactionMembers(factionId, force, state, dom, ffDefaults, preserveCachedBattleStats) {
        return new Promise(async (resolve) => {
            if (!factionId) resolve();
            const teamKey = `faction:${factionId}`;
            const ttl = state.REFRESH_MS || (state.refreshPeriodSeconds || 30) * 1000;
            if (!force) {
                const cached = state.getCachedFaction(factionId, ttl);
                if (cached && Array.isArray(cached.members) && cached.members.length) {
                    let players = cached.members.map(m => updateFromTornAPIData({}, m));
                    players = preserveCachedBattleStats(teamKey, players);
                    try {
                        await this.maybeFetchFfScouterStats(players, ffDefaults);
                        state.cacheFactionPlayers(teamKey, players);
                    } catch (e) {
                        state.cacheFactionPlayers(teamKey, players);
                    }
                    if (dom.playersTitle) {
                        const name = cached.name || `Faction ${factionId}`;
                        dom.playersTitle.textContent = `${name} [${factionId}]`;
                    }
                    if (dom.teamLastRun) {
                        const ts = state.factionPlayersTimestamp[teamKey];
                        if (ts) {
                            try { dom.teamLastRun.textContent = `Last: ${new Date(ts).toLocaleTimeString()}`; } catch (e) {}
                        }
                    }
                    resolve();
                }
            }
            if (!state.apikey) resolve();
            const data = await this.getFaction(factionId, state.apikey);
            if (data.error) {
                console.error('Faction lookup error', data.error);
                resolve();
            }
            const faction = data.faction || data || {};
            const resolvedName = faction.name || faction.basic?.name || data.name || data.basic?.name || `Faction ${factionId}`;
            const membersRaw = Array.isArray(faction.members)
                ? faction.members
                : Array.isArray(faction?.members?.members)
                    ? faction.members.members
                    : Array.isArray(data.members) ? data.members : [];
            let players = (membersRaw || []).map(m => updateFromTornAPIData({}, m));
            players = preserveCachedBattleStats(teamKey, players);
            const factionToCache = { ...faction, name: resolvedName };
            state.cacheFactionData(factionId, factionToCache);
            try {
                await this.maybeFetchFfScouterStats(players, ffDefaults);
            } catch (e) {}
            state.cacheFactionPlayers(teamKey, players);
            if (dom.teamLastRun) {
                const ts = state.factionPlayersTimestamp[teamKey];
                if (ts) {
                    try { dom.teamLastRun.textContent = `Last: ${new Date(ts).toLocaleTimeString()}`; } catch (e) {}
                }
            }
            state.teams = [{ id: teamKey, name: resolvedName, participants: players.length }];
            state.cacheMetadata(state.user, state.teams);
            if (dom.playersTitle) dom.playersTitle.textContent = `${resolvedName} [${factionId}]`;
            resolve();
        });
    },

    getPlayerIdentifier(player) {
        const candidates = ["id", "player_id", "user_id", "torn_id", "tornid"];
        for (const key of candidates) {
            if (player[key] !== undefined && player[key] !== null) {
                return player[key];
            }
        }
        return null;
    }
};
