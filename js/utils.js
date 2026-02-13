// utils.js
// Utility functions for Torn War Intel

function parseBattlestatValue(value) {
    if (value === undefined || value === null || value === "--") return null;
    if (typeof value === "number") return value;
    if (typeof value !== "string") return value;
    const cleaned = value.replace(/,/g, "").trim();
    const lower = cleaned.toLowerCase();
    let multiplier = 1;
    if (lower.endsWith("b")) multiplier = 1e9;
    else if (lower.endsWith("m")) multiplier = 1e6;
    else if (lower.endsWith("k")) multiplier = 1e3;
    const numeric = parseFloat(cleaned);
    if (Number.isNaN(numeric)) return lower;
    return numeric * multiplier;
}

function compareValues(a, b, direction) {
    const multiplier = direction === "asc" ? 1 : -1;
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    const aNum = typeof a === "number" ? a : Number(a);
    const bNum = typeof b === "number" ? b : Number(b);
    const aIsNum = !Number.isNaN(aNum);
    const bIsNum = !Number.isNaN(bNum);
    if (aIsNum && bIsNum) {
        if (aNum === bNum) return 0;
        return aNum > bNum ? multiplier : -multiplier;
    }
    const aStr = a.toString();
    const bStr = b.toString();
    return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" }) * multiplier;
}

function formatHMS(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

module.exports = {
    parseBattlestatValue,
    compareValues,
    formatHMS
};
