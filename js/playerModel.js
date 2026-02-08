// playerModel.js
// Player model and enums for Torn War Intel

const { LocationEnum } = require("./countryMapping.js");

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
 * @property {number} [timeSinceLastAction] - Time (seconds) since last action
 * @property {string} [activitycolor] - Color code for activity recency
 * @property {"to"|"from"|null} [travelDirection] - If travelling, direction relative to Torn ("to" or "from" the country)
 * @property {LocationEnum|null} [travelCountry] - If travelling, the non-Torn country involved in the trip
 */

module.exports = {
    PlayerStatusEnum,
    LocationEnum,
    // Player typedef is for JSDoc only
};
