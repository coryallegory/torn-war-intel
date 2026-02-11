// constants.js
// Centralized enums and constants for Torn War Intel

const PlayerStatusEnum = Object.freeze({
    OKAY: "Okay",
    HOSPITALIZED: "Hospitalized",
    JAIL: "Jail",
    TRAVELLING: "Travelling",
    OTHER: "Other"
});

const LocationEnum = Object.freeze({
    TORN: "Torn",
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
    UNKNOWN: "Unknown"
});

module.exports = {
    PlayerStatusEnum,
    LocationEnum
};
