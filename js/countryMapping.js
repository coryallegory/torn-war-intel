
// countryMapping.js
// Maps alternate country/location names and adjectives to canonical Torn city/location names

const { LocationEnum } = require("./constants.js");

// Unified synonym list for all countries
const COUNTRY_SYNONYMS = [
    // Torn
    ["torn", LocationEnum.TORN],
    ["torn city", LocationEnum.TORN],

    // Argentina
    ["argentina", LocationEnum.ARGENTINA],
    ["argentinian", LocationEnum.ARGENTINA],

    // Canada
    ["canada", LocationEnum.CANADA],
    ["canadian", LocationEnum.CANADA],

    // Cayman Islands
    ["cayman", LocationEnum.CAYMAN_ISLANDS],
    ["cayman islands", LocationEnum.CAYMAN_ISLANDS],

    // China
    ["china", LocationEnum.CHINA],
    ["chinese", LocationEnum.CHINA],

    // Hawaii
    ["hawaii", LocationEnum.HAWAII],
    ["hawaiian", LocationEnum.HAWAII],

    // Japan
    ["japan", LocationEnum.JAPAN],
    ["japanese", LocationEnum.JAPAN],

    // Mexico
    ["mexico", LocationEnum.MEXICO],
    ["mexican", LocationEnum.MEXICO],

    // South Africa
    ["south africa", LocationEnum.SOUTH_AFRICA],
    ["southafrica", LocationEnum.SOUTH_AFRICA],
    ["south african", LocationEnum.SOUTH_AFRICA],

    // Switzerland
    ["switzerland", LocationEnum.SWITZERLAND],
    ["swiss", LocationEnum.SWITZERLAND],

    // UAE
    ["uae", LocationEnum.UAE],
    ["united arab emirates", LocationEnum.UAE],
    ["dubai", LocationEnum.UAE],
    ["emirati", LocationEnum.UAE],

    // United Kingdom
    ["united kingdom", LocationEnum.UNITED_KINGDOM],
    ["uk", LocationEnum.UNITED_KINGDOM],
    ["british", LocationEnum.UNITED_KINGDOM]
];

// Build a lookup map for synonyms
const COUNTRY_SYNONYM_MAP = (() => {
    const map = new Map();
    Object.values(LocationEnum).forEach(loc => map.set(loc.toLowerCase(), loc));
    COUNTRY_SYNONYMS.forEach(([syn, loc]) => map.set(syn.toLowerCase(), loc));
    return map;
})();

/**
 * Normalize a raw location name to a canonical LocationEnum value.
 * @param {string} rawName
 * @returns {LocationEnum|null}
 */
function normalizeLocationName(rawName) {
    if (!rawName || typeof rawName !== "string") return null;
    const cleaned = rawName.trim().toLowerCase();
    if (!cleaned) return null;
    return COUNTRY_SYNONYM_MAP.get(cleaned) || null;
}

module.exports = {
    COUNTRY_SYNONYMS,
    COUNTRY_SYNONYM_MAP,
    normalizeLocationName
};
