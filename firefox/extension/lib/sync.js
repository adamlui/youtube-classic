window.sync = {

    checkShortsToRedir() {
        if (location.pathname.startsWith('/shorts/'))
            return location.replace(`https://www.youtube.com/watch?v=${location.pathname.split('/')[2]}`)
        window.sync.checkShortsToRedir.id = requestAnimationFrame(window.sync.checkShortsToRedir)
    },

    configToUI({ key } = {}) {
        if (key == 'restoreDislikes')
            styles.update({ key: 'dislikes' })
        else if (key == 'unroundCorners')
            styles.update({ key: 'unround' })
        else if (key == 'disableShorts') {
            if (app.config.disableShorts && !this.checkShortsToRedir.id)
                this.checkShortsToRedir()
            else if (!app.config.disableShorts && this.checkShortsToRedir.id) {
                cancelAnimationFrame(this.checkShortsToRedir.id) ; this.checkShortsToRedir.id = null }
        } else if (key.endsWith('Block'))
            styles.update({ key: 'block' })
        else if (key == 'idlePrevention')
            this.idle.toUI()
        gmToolbarMenu.refresh() // prefixes/suffixes
    },

    idle: {
        prevent() {
            Object.defineProperties(document, { // force page visibility
                hidden: { configurable: true, value: false },
                webkitHidden: { configurable: true, value: false },
                visibilityState: { configurable: true, value: 'visible' },
                webkitVisibilityState: { configurable: true, value: 'visible' }
            })
            this.prevent.id = setInterval(() => // send pulse
                document.dispatchEvent(new KeyboardEvent('keyup', {
                    bubbles: true, cancelable: true, keyCode: 143, which: 143 }))
            , 60000)
        },

        toUI() {
            if (app.config.idlePrevention && !this.prevent.id) this.prevent()
            else if (!app.config.idlePrevention && this.prevent.id) {
                clearInterval(this.prevent.id) ; this.prevent.id = null
                delete document.hidden
                delete document.webkitHidden
                delete document.visibilityState
                delete document.webkitVisibilityState
            }
        }
    },

    update: {
        headerLogo() {
            app.logo ??= dom.create.elem('img', { style: 'margin-left: 5px', height: 65 })
            const ytLogo = document.getElementById('logo-icon') ; if (!ytLogo) return
            const ytScheme = document.querySelector('ytd-masthead[dark]')
                          || window.matchMedia?.('(prefers-color-scheme: dark)').matches
                                ? 'dark' : 'light'
            app.logo.src = `${app.urls.images}/logos/youtube/${ytScheme}mode.png`
            ytLogo.textContent = '' ; ytLogo.append(app.logo)
        }
    }
};
