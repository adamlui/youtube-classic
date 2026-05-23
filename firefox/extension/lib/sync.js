window.sync = {

    configToUI({ key } = {}) {
        if (key == 'restoreDislikes')
            styles.update({ key: 'dislikes' })
        else if (key == 'unroundCorners')
            styles.update({ key: 'unround' })
        else if (key == 'disableShorts')
            this.shorts.configToUI()
        else if (key.endsWith('Block'))
            styles.update({ key: 'block' })
        else if (key == 'idlePrevention')
            this.idle.configToUI()
        gmToolbarMenu.refresh() // prefixes/suffixes
    },

    headerLogo() {
        const ytLogo = document.getElementById('logo-icon') ; if (!ytLogo) return
        app.logo ??= dom.create.elem('img', { style: 'margin-left: 5px', height: 65 })
        app.logo.src = `${app.urls.images}/logos/youtube/${ui.getScheme()}mode.png`
        ytLogo.textContent = '' ; ytLogo.append(app.logo)
    },

    idle: {
        configToUI() {
            if (app.config.idlePrevention && !this.prevent.id)
                this.prevent()
            else if (!app.config.idlePrevention && this.prevent.id) {
                clearInterval(this.prevent.id) ; this.prevent.id = null
                delete document.hidden
                delete document.webkitHidden
                delete document.visibilityState
                delete document.webkitVisibilityState
            }
        },

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
        }
    },

    shorts: {
        configToUI() {
            if (app.config.disableShorts && !this.redir.id)
                this.redir()
            else if (!app.config.disableShorts && this.redir.id) {
                cancelAnimationFrame(this.redir.id) ; this.redir.id = null }
        },

        redir() {
            if (location.pathname.startsWith('/shorts/'))
                return location.replace(`https://www.youtube.com/watch?v=${location.pathname.split('/')[2]}`)
            window.sync.shorts.redir.id = requestAnimationFrame(window.sync.shorts.redir)
        }
    }
};
