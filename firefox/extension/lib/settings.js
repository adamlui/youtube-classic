window.settings = {

    categories: {
        restoreModes: { symbol: '🔧', autoExpand: true, color: '1e5919' /* green */ },
        blockModes: { symbol: '⛔', color: 'a80104' /* red */ },
        perfModes: { symbol: '🏁', color: '856cb7' /* purple */ },
        notifSettings: { symbol: '📣', color: '16e4f7' /* teal */ }
    },

    controls: { // displays top-to-bottom in toolbar menu
        restoreDislikes: { type: 'toggle', defaultVal: true, category: 'restoreModes' },
        unroundCorners: { type: 'toggle', defaultVal: true, category: 'restoreModes' },
        disableShorts: { type: 'toggle', defaultVal: true, category: 'blockModes' },
        shortsBlock: { type: 'toggle', defaultVal: true, category: 'blockModes' },
        playablesBlock: { type: 'toggle', defaultVal: true, category: 'blockModes' },
        adBlock: { type: 'toggle', defaultVal: false, category: 'blockModes' },
        aiBlock: { type: 'toggle', defaultVal: true, category: 'blockModes' },
        reduceAnimations: { type: 'toggle',  defaultVal: true, category: 'perfModes' },
        idlePrevention: { type: 'toggle', defaultVal: true, category: 'perfModes' },
        notifDisabled: { type: 'toggle', defaultVal: false, category: 'notifSettings' },
        notifBottom: { type: 'toggle', defaultVal: false, category: 'notifSettings' },
        toastMode: { type: 'toggle', defaultVal: false, category: 'notifSettings' }
    },

    getMsg(key) {
        this.msgKeys ??= new Map() // to cache keys for this.isEnabled() inversion logic
        const msg = typeof GM_info != 'undefined' ? app.msgs[key] : i18n.getMsg(key)
        this.msgKeys.set(msg, key)
        return msg
    },

    initLabelHelptip() {
        for (const [group, prefix] of Object.entries({ categories: 'menuLabel', controls: 'mode' }))
            for (const [key, obj] of Object.entries(window.settings[group]))
                Object.assign(obj, { label: this.getMsg(`${prefix}_${key}`), helptip: this.getMsg(`helptip_${key}`) })
        this.initLabelHelptip.hasRun = true
    },

    load(...keys) {
        app.config ??= {}
        keys = keys.flat() // flatten array args nested by spread operator
        if (!this.initLabelHelptip.hasRun) this.initLabelHelptip()
        if (typeof GM_info != 'undefined') // synchronously load from userscript manager storage
            keys.forEach(key =>
                app.config[key] = processKey(key, GM_getValue(`${app.configKeyPrefix}_${key}`, undefined)))
        else // asynchronously load from browser extension storage
            return Promise.all(keys.map(async key =>
                app.config[key] = processKey(key, (await browserAPI.storage.local.get(key))[key])))
        function processKey(key, val) {
            const ctrl = settings.controls?.[key]
            if (val != undefined && ( // validate stored val
                    (ctrl?.type == 'toggle' && typeof val != 'boolean')
                 || (ctrl?.type == 'slider' && isNaN(parseFloat(val)))
            )) val = undefined
            return val ?? (ctrl?.defaultVal ?? (ctrl?.type == 'slider' ? 100 : false))
        }
    },

    save(key, val) {
        app.config ??= {}
        if (typeof GM_info != 'undefined') // save to userscript manager storage
            GM_setValue(`${app.configKeyPrefix}_${key}`, val)
        else // save to browser extension storage
            browserAPI.storage.local.set({ [key]: val })
        app.config[key] = val // save to memory
    },

    typeIsEnabled(key) { // for menu labels + notifs to return ON/OFF for type w/o suffix
        app.config ??= {}
        const reInvertFlags = /disabled|hidden/i
        return reInvertFlags.test(key) // flag in control key name
            && !reInvertFlags.test(this.msgKeys.get(this.controls[key]?.label) || '') // but not in label msg key name
                ? !app.config[key] : app.config[key] // so invert since flag reps opposite type state, else don't
    }
};
