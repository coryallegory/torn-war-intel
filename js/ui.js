// ui.js
// UI rendering and DOM manipulation for Torn War Intel

const ui = {
    setStatus(el, text, isError = false, hide = false) {
        if (!el) return;
        el.textContent = text;
        el.classList.toggle("status-error", Boolean(isError));
        el.classList.toggle("hidden", Boolean(hide));
    },
    setApiKeyApplyMode(dom) {
        dom.apikeyInputRow.classList.remove("hidden");
        dom.apikeyDisplayRow.classList.add("hidden");
        dom.apikeyPrompt.classList.add("hidden");
        dom.apikeyRememberWrap.classList.remove("hidden");
    },
    setApiKeyClearMode(dom) {
        dom.apikeyInput.value = "";
        dom.apikeyInputRow.classList.add("hidden");
        dom.apikeyDisplayRow.classList.remove("hidden");
        dom.apikeyPrompt.classList.remove("hidden");
        dom.apikeyRememberWrap.classList.add("hidden");
    },
    renderUserInfo(dom, user, mapStateColor, getStatusText) {
        if (!user) return;
        const stateColor = mapStateColor(user.status.state);
        const statusText = getStatusText(user);
        dom.userInfoContent.innerHTML = `
            <div><strong>${user.name}</strong> [${user.level}]</div>
            <div class="${stateColor}">${statusText}</div>
        `;
    },
    // ...other UI rendering functions to be moved from app.js...
};

module.exports = ui;
