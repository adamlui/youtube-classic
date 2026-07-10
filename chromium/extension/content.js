(async () => {

    addEventListener('message', event => { // from userscript to disable extension
        if (event.origin != location.origin || !event.data?.source?.endsWith('youtube-classic.user.js')) return
        postMessage({ source: 'youtube-classic/*/extension/content.js' }, location.origin)
    })

    for (const resource of [
        'components/modals.js', 'lib/css.min.js', 'lib/dom.min.js', 'lib/exp-flags.js', 'lib/feedback.js',
        'lib/i18n.js', 'lib/settings.js', 'lib/styles.js', 'lib/sync.js', 'lib/ui.js'
    ]) await import(chrome.runtime.getURL(resource))

    window.xhr = config =>
        fetch(config.url, { method: config.method || 'GET', headers: config.headers, body: config.data })
            .then(async resp =>
                config.onload?.({ responseText: await resp.text(), status: resp.status, statusText: resp.statusText }))
            .catch(err =>
                config.onerror?.(err))

    window.env = {
        browser: {
            language: chrome.i18n.getUILanguage(),
            isFF: navigator.userAgent.includes('Firefox'),
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        }
    }
    Object.assign(env.browser, { get isCompact() { return innerWidth <= 480 }})
    env.userLocale = env.browser.language.includes('-') ? env.browser.language.split('-')[1].toLowerCase() : ''

    chrome.runtime.onMessage.addListener(({ action, options, source }) => { // from background/popup
        ({
            notify: () => feedback.notify(...['msg', 'pos', 'notifDuration', 'shadow'].map(arg => options[arg])),
            alert: () => modals.alert(...['title', 'msg', 'btns', 'checkbox', 'width'].map(arg => options[arg])),
            showAbout: () => {
                if (source?.endsWith('service-worker.js'))
                    dom.get.loadedElem('ytd-masthead').then(() => modals.open('about'))
            },
            syncConfigToUI: async () => sync.configToUI(options)
        }[action]())
    })

    ;({ app: window.app } = await chrome.storage.local.get('app'))

    // Run MAIN routine

    await settings.load('extensionDisabled', Object.keys(settings.controls))
    if (app.config.extensionDisabled) return
    if (app.config.disableShorts) sync.shorts.redir()
    styles.update({ keys: Object.keys(styles).filter(key => styles[key].autoAppend) })
    dom.get.loadedElem(app.selectors.yt.logo).then(() => sync.headerLogo())
    dom.get.loadedElem(app.selectors.yt.masthead).then(masthead =>
        new MutationObserver(sync.headerLogo).observe(masthead, {
            attributes: true, subtree: true, attributeFilter: ['dark'] })
    )
    expFlags.init({ reduceAnimations: app.config.reduceAnimations, presetFlags: app.ui.expFlags })
    if (app.config.idlePrevention) sync.idle.prevent()

})()
