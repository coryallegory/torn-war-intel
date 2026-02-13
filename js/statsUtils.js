// statsUtils.js
// Utility functions for player and battlestat logic in Torn War Intel

function preserveCachedBattleStats(teamId, players, state, getPlayerIdentifier, hasMeaningfulBsValue, deriveBsEstimateNumber) {
    const existing = state.factionPlayers[teamId];
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

function hasMeaningfulBsValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "" && value !== "--";
    if (typeof value === "number") return !Number.isNaN(value);
    return false;
}

function deriveBsEstimateNumber(player, parseBattlestatValue) {
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

module.exports = {
    preserveCachedBattleStats,
    hasMeaningfulBsValue,
    deriveBsEstimateNumber
};
