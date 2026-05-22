window.i18n = {
    getMsg(key) {
        return typeof GM_info == 'undefined' ?
            browserAPI.i18n.getMessage(key) // from ./_locales/*/messages.json
                : app.msgs[key] // from userscript
    }
};
