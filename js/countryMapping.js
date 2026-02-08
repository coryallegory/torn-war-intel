// countryMapping.js
// Maps alternate country/location names and adjectives to canonical Torn city/location names

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

// Map of alternate names/adjectives to canonical location
const locationNameMap = {
    // Torn
    "torn": LocationEnum.TORN,
    "torn city": LocationEnum.TORN,

    // Argentina
    "argentina": LocationEnum.ARGENTINA,
    "argentinian": LocationEnum.ARGENTINA,

    // Canada
    "canada": LocationEnum.CANADA,
    "canadian": LocationEnum.CANADA,

    // Cayman Islands
    "cayman": LocationEnum.CAYMAN_ISLANDS,
    "cayman islands": LocationEnum.CAYMAN_ISLANDS,

    // China
    "china": LocationEnum.CHINA,
    "chinese": LocationEnum.CHINA,

    // Hawaii
    "hawaii": LocationEnum.HAWAII,
    "hawaiian": LocationEnum.HAWAII,

    // Japan
    "japan": LocationEnum.JAPAN,
    "japanese": LocationEnum.JAPAN,

    // Mexico
    "mexico": LocationEnum.MEXICO,
    "mexican": LocationEnum.MEXICO,

    // South Africa
    "south africa": LocationEnum.SOUTH_AFRICA,
    "southafrica": LocationEnum.SOUTH_AFRICA,
    "south african": LocationEnum.SOUTH_AFRICA,

    // Switzerland
    "switzerland": LocationEnum.SWITZERLAND,
    "swiss": LocationEnum.SWITZERLAND,

    // UAE
    "uae": LocationEnum.UAE,
    "united arab emirates": LocationEnum.UAE,

    // United Kingdom
    "united kingdom": LocationEnum.UNITED_KINGDOM,
    "uk": LocationEnum.UNITED_KINGDOM,
    "british": LocationEnum.UNITED_KINGDOM
};

function canonicalizeLocation(str) {
    if (!str) return LocationEnum.UNKNOWN;
    const key = str.trim().toLowerCase();
    return locationNameMap[key] || LocationEnum.UNKNOWN;
}

module.exports = {
    LocationEnum,
    locationNameMap,
    canonicalizeLocation
};
