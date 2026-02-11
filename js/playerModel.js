// Helper to provide canonical status text for player rendering
function getStatusText(player) {
    if (!player || !player.status) return "Unknown";
    switch (player.status) {
        case PlayerStatusEnum.OKAY:
            return "Okay";
        case PlayerStatusEnum.JAIL:
            return "Jail";
        case PlayerStatusEnum.HOSPITALIZED:
            return `Hospitalized (${player.location})`;
        case PlayerStatusEnum.TRAVELLING:
            if (player.travelDirection === "to") {
                return `Travelling to ${player.travelCountry}`;
            } else if (player.travelDirection === "from") {
                return `Returning from ${player.travelCountry}`;
            } else {
                return "Travelling";
            }
        case PlayerStatusEnum.OTHER:
            return "Other";
        default:
            return "Unknown";
    }
}

module.exports = {
    ...module.exports,
    getStatusText
};
// playerModel.js
// Player model and enums for Torn War Intel

const { LocationEnum, LOCATION_SYNONYMS, normalizeLocationName } = require("./countryMapping.js");

const PlayerStatusEnum = Object.freeze({
    OKAY: "Okay",
    HOSPITALIZED: "Hospitalized",
    JAIL: "Jail",
    TRAVELLING: "Travelling",
    OTHER: "Other"
});

/**
 * Player Model
 * @typedef {Object} Player
 * @property {string|number} id - Unique player identifier
 * @property {string} name - Player name
 * @property {LocationEnum} location - Canonicalized location
 * @property {Object} battlestats - Player battle stats object
 * @property {PlayerStatusEnum} status - Player status
 * @property {number} level - Player level
 * @property {number} [timeUntilOk] - Time (seconds) until status is OK/landed
 * @property {number} [hospitalLeaveTime] - Unix timestamp when user leaves hospital
 * @property {number} [travelLandTime] - Unix timestamp when user lands from travel
 * @property {number} [timeSinceLastAction] - Time (seconds) since last action
 * @property {string} [activitycolor] - Color code for activity recency
 * @property {Object} [rawTornAPIData] - Original player object from Torn API
 * @property {Object} [rawFFScouterAPIData] - Original player object from FFScouter API
 * @property {"to"|"from"|null} [travelDirection] - If travelling, direction relative to Torn ("to" or "from" the country)
 * @property {LocationEnum|null} [travelCountry] - If travelling, the non-Torn country involved in the trip
// Update a player object with new Torn API data.
 */
// Update a player object with new Torn API data.
function updateFromTornAPIData(player, apiData) {
    // Determine location and travel info using canonicalization and synonym mapping
    const id = apiData.id ?? apiData.player_id ?? apiData.user_id ?? apiData.torn_id ?? apiData.tornid;
    const name = apiData.name;
    const level = apiData.level;
    const status = apiData.status || { state: "--", description: "--" };
    const last_action = apiData.last_action || {};
    let location = LocationEnum.UNKNOWN;
    let travelDirection = null;
    let travelCountry = null;
    let hospitalLeaveTime = null;
    let travelLandTime = null;
    if (apiData.status && apiData.status.state) {
        const state = apiData.status.state;
        if (state === "Hospital") {
            // Try to extract location from hospital description
            const desc = apiData.status.description || "";
            const match = desc.match(/([A-Za-z\s]+) hospital/i);
            if (match) {
                location = normalizeLocationName(match[1].trim()) || canonicalizeLocation(match[1].trim());
            } else {
                location = LocationEnum.TORN;
            }
            // Parse hospital leave time if available
            if (typeof apiData.status.until === "number") {
                hospitalLeaveTime = apiData.status.until;
            }
        } else if (state === "Abroad") {
            const destination = apiData.status.details?.destination || apiData.status.details?.country || null;
            location = normalizeLocationName(destination) || canonicalizeLocation(destination);
        } else if (state === "Traveling") {
            // Extract travel direction and country
            const desc = apiData.status.description || "";
            let direction = null;
            let place = null;
            const returningMatch = desc.match(/returning to torn from\s+(.+)/i);
            if (returningMatch) {
                direction = "from";
                place = returningMatch[1];
            } else {
                const travelingToMatch = desc.match(/traveling to\s+(.+)/i);
                if (travelingToMatch) {
                    direction = "to";
                    place = travelingToMatch[1];
                }
            }
            if (place) {
                location = normalizeLocationName(place) || canonicalizeLocation(place);
                travelDirection = direction;
                travelCountry = location;
            } else {
                location = LocationEnum.UNKNOWN;
            }
            // Parse travel landing time if available
            if (typeof apiData.status.until === "number") {
                travelLandTime = apiData.status.until;
            }
        } else if (state === "Okay") {
            location = LocationEnum.TORN;
        } else {
            location = LocationEnum.UNKNOWN;
        }
    }
    return {
        ...player,
        id,
        name,
        level,
        status,
        last_action,
        location,
        travelDirection,
        travelCountry,
        hospitalLeaveTime,
        travelLandTime,
        rawTornAPIData: apiData,
        rawFFScouterAPIData: player.rawFFScouterAPIData // preserve FFScouter data
    };
}

/**
 * Update a player object with new FFScouter API data.
 * @param {Player} player
 * @param {Object} ffData - Raw FFScouter API player object
 * @returns {Player}
 */
function updateFromFFScouterAPIData(player, ffData) {
    // Compute battlestats from FFScouter API payload
    // FFScouter may return battlestats as a property, or as bs_estimate_human/bs_estimate
    let battlestats = ffData?.battlestats;
    if (!battlestats && (ffData?.bs_estimate_human || ffData?.bs_estimate)) {
        battlestats = {
            bs_estimate_human: ffData.bs_estimate_human,
            bs_estimate: ffData.bs_estimate
        };
    }
    return {
        ...player,
        rawFFScouterAPIData: ffData,
        battlestats: battlestats ?? player.battlestats
    };
}

module.exports = {
    PlayerStatusEnum,
    LocationEnum,
    updateFromTornAPIData,
    updateFromFFScouterAPIData
    // Player typedef is for JSDoc only
};
