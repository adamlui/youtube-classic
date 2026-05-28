window.expFlags = {
    _config: {},
    _observer: null,
    _watching: false,

    _isObject(item) { return item && typeof item === 'object' && !Array.isArray(item) },

    _mergeDeep(target, ...sources) {
        if (!sources.length) return target
        const source = sources.shift()
        if (this._isObject(target) && this._isObject(source))
            for (const key in source)
                if (this._isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} })
                    this._mergeDeep(target[key], source[key])
                } else Object.assign(target, { [key]: source[key] })
        return this._mergeDeep(target, ...sources)
    },

    _inject() {
        if (!window.yt?.config_) return false
        this._mergeDeep(window.yt.config_, this._config)
        return true
    },

    _onMutation(mutations) { if (mutations.some(mut => mut.addedNodes.length)) this._inject() },

    start() {
        if (this._watching) return
        this._watching = true
        this._observer = new MutationObserver(this._onMutation.bind(this))
        this._observer.observe(document, { childList: true, subtree: true })
    },

    stop() {
        if (this._observer) { this._observer.disconnect() ; this._observer = null }
        this._watching = false
    },

    set(flags, applyNow = true) {
        if (!('EXPERIMENT_FLAGS' in this._config)) this._config.EXPERIMENT_FLAGS = {}
        this._mergeDeep(this._config.EXPERIMENT_FLAGS, flags)
        if (applyNow) this._inject()
    },

    toggle(key, enabled) { this.set({ [key]: enabled }) },

    disableAll(pattern = /.*/) {
        const flags = this._config.EXPERIMENT_FLAGS || {}
        for (const key of Object.keys(flags)) if (pattern.test(key)) flags[key] = false
        this._inject()
    },

    enableAll(pattern = /.*/) {
        const flags = this._config.EXPERIMENT_FLAGS || {}
        for (const key of Object.keys(flags)) if (pattern.test(key)) flags[key] = true
        this._inject()
    },

    animations: {
        disable: () => window.expFlags.disableAll(/_animated_/),
        enable:  () => window.expFlags.enableAll(/_animated_/),
        toggle: enabled => enabled ? window.expFlags.animations.enable() : window.expFlags.animations.disable()
    },

    init({ reduceAnimations, presetFlags } = {}) {
        if (presetFlags) {
            Object.keys(presetFlags)
                .filter(key => /_animated_/.test(key))
                .forEach(key => presetFlags[key] = !reduceAnimations)
            this.set(presetFlags, false) // store but don't inject yet (yt.config_ may not exist)
        }
        this.start()
        addEventListener('yt-page-data-updated', function handler() {
            window.expFlags.stop()
            removeEventListener('yt-page-data-updated', handler)
        })
    }
}
