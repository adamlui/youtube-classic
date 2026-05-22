
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
        notifDisabled: { type: 'toggle', defaultVal: false, category: 'notifSettings' }
    },

    initLabelHelptip() {
        for (const [group, prefix] of Object.entries({ categories: 'menuLabel', controls: 'mode' }))
            for (const [key, obj] of Object.entries(window.settings[group]))
                Object.assign(obj, { label: i18n.getMsg(`${prefix}_${key}`), helptip: i18n.getMsg(`helptip_${key}`) })
    },

    load(...keys) {
        if (!this.labelHelptipSet) this.initLabelHelptip()
        keys.flat().forEach(key =>
            app.config[key] = processKey(key, GM_getValue(`${app.configKeyPrefix}_${key}`, undefined)))
        function processKey(key, val) {
            const ctrl = settings.controls?.[key]
            if (val != undefined && ( // validate stored val
                    (ctrl?.type == 'toggle' && typeof val != 'boolean')
                 || (ctrl?.type == 'slider' && isNaN(parseFloat(val)))
            )) val = undefined
            return val ?? (ctrl?.defaultVal ?? (ctrl?.type == 'slider' ? 100 : false))
        }
    },

    save(key, val) { GM_setValue(`${app.configKeyPrefix}_${key}`, val) ; app.config[key] = val },

    typeIsEnabled(key) { // for menu labels + notifs to return ON/OFF
        const reInvertSuffixes = /disabled|hidden/i
        return reInvertSuffixes.test(key) // flag in control key name
            && !reInvertSuffixes.test(this.controls[key]?.label || '') // but not in label msg key name
                ? !app.config[key] : app.config[key] // so invert since flag reps opposite type state, else don't
    }
};
