// New state.js for Torn War Intel
// Holds: apikey, refreshPeriod, lastRefreshTimestamp, players array

const STATE_KEY = "tornwarintel_state";
const APIKEY_KEY = "tornwarintel_apikey";

const defaultState = {
    apikey: null,
    refreshPeriod: 10,
    lastRefreshTimestamp: null,
    players: []
};

let state = { ...defaultState };

function loadStateFromStorage() {
    // Load main state
    const stored = localStorage.getItem(STATE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            state = { ...defaultState, ...parsed };
        } catch (e) {
            state = { ...defaultState };
        }
    } else {
        state = { ...defaultState };
    }
    // Load apikey separately
    const apikey = localStorage.getItem(APIKEY_KEY);
    if (apikey) state.apikey = apikey;
}

function saveStateToStorage() {
    // Save everything except apikey
    const { apikey, ...toStore } = state;
    localStorage.setItem(STATE_KEY, JSON.stringify(toStore));
    // Save apikey separately if present
    if (apikey) {
        localStorage.setItem(APIKEY_KEY, apikey);
    } else {
        localStorage.removeItem(APIKEY_KEY);
    }
}

function setApiKey(newKey) {
    state.apikey = newKey;
    if (newKey) {
        localStorage.setItem(APIKEY_KEY, newKey);
    } else {
        localStorage.removeItem(APIKEY_KEY);
    }
}

function clearState() {
    state = { ...defaultState };
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(APIKEY_KEY);
}

window.state = state;
window.loadStateFromStorage = loadStateFromStorage;
window.saveStateToStorage = saveStateToStorage;
window.setApiKey = setApiKey;
window.clearState = clearState;
