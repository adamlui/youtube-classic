(async () => {

    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches)
        document.documentElement.classList.add('dark')

    window.env = { browser: { isFF: navigator.userAgent.includes('Firefox') }}

    for (const resource of [
        'components/icons.js', 'lib/css.min.js', 'lib/dom.min.js', 'lib/i18n.js', 'lib/settings.js', 'lib/string.js',
        'lib/ui.js'
    ]) await import(chrome.runtime.getURL(resource))

    window.env = {
        site: new URL((await chrome.tabs.query({ active: true, currentWindow: true }))[0].url)
            .hostname.split('.').slice(-2, -1)[0], // extract 2nd-level domain
        menu: { isDark: document.documentElement.classList.contains('dark') }
    }
    env.onMatchedPage = chrome.runtime.getManifest().content_scripts[0].matches.toString().includes(env.site)
    ;({ app: window.app } = await chrome.storage.local.get('app'))

    function createMenuEntry(entryData) {
        const entry = {
            div: dom.create.elem('div', {
                id: entryData.key, class: 'menu-entry highlight-on-hover', title: entryData.helptip || '' }),
            leftElem: dom.create.elem('div', { class: `menu-icon ${ entryData.type || '' }`}),
            label: dom.create.elem('span', { textContent: entryData.label })
        }
        entry.div.append(entry.leftElem, entry.label)

        if (entryData.type == 'toggle') { // add track to left, init knob pos
            entry.leftElem.append(dom.create.elem('span', { class: 'track' }))
            entry.leftElem.classList.toggle('on', settings.typeIsEnabled(entryData.key))

        } else { // add symbol to left, append status to right
            entry.leftElem.textContent = entryData.symbol || '⚙️' ; entry.label.style.flexGrow = 1
            if (entryData.status) entry.label.textContent += ` — ${entryData.status}`
            if (entryData.type == 'link') {
                entry.label.after(entry.rightElem = dom.create.elem('div', { class: 'menu-right-elem' }))
                if (entryData.favicon) entry.favicon = dom.create.elem('img', { width: 15,
                    src: typeof entryData.favicon == 'string' ? entryData.favicon
                            : `https://www.google.com/s2/favicons?domain=${new URL(entryData.url).hostname}` })
                entry.openIcon = icons.create({ key: 'open', size: 17, fill: 'black' })
                entry.rightElem.append(entry.favicon || entry.openIcon)
                if (entry.favicon) entry.rightElem.onmouseenter = entry.rightElem.onmouseleave = ({ type }) =>
                    entry.rightElem.firstChild.replaceWith(entry[type == 'mouseenter' ? 'openIcon' : 'favicon'])
            }
        }

        if (entryData.type == 'category') // append drop-down caret
            entry.div.append(icons.create({ key: 'caretDown', size: 11, class: 'menu-caret menu-right-elem' }))

        else if (entryData.type == 'slider') { // append slider, add listeners, remove .highlight-on-hover
            const minVal = entryData.min ?? 0, maxVal = entryData.max ?? 100

            // Create/append slider elems
            entry.div.append(entry.slider = dom.create.elem('input', { class: 'slider', type: 'range',
                min: minVal, max: maxVal, value: app.config[entryData.key] }))
            entry.div.classList.remove('highlight-on-hover')
            if (entryData.step || env.browser?.isFF) // use val from entryData or default to 2% in FF for being laggy
                entry.slider.step = entryData.step || ( 0.02 * entry.slider.max - entry.slider.min )
            entry.label.textContent += `: ${entry.slider.value}${ entryData.labelSuffix || '' }`
            entry.label.append(entry.editLink = dom.create.elem('span', {
                class: 'edit-link', role: 'button', tabindex: '0', 'aria-label': entryData.helptip,
                textContent: i18n.getMsg('promptLabel_edit')
            }))
            entry.slider.style.setProperty('--track-fill-percent', `${ entry.slider.value / entry.slider.max *100 }%`)

            // Add listeners
            entry.editLink.onclick = () => {
                const promptMsg = `${i18n.getMsg('prompt_enterNewVal')} ${entryData.label} (${
                    i18n.getMsg('error_between')} ${minVal}–${maxVal}):`
                const userVal = prompt(promptMsg, entry.slider.value)
                if (userVal == null) return // user cancelled so do nothing
                if (!/\d/.test(userVal)) return alert(`${
                    i18n.getMsg('error_enterValidNum')} ${i18n.getMsg('error_between')} ${
                        minVal} ${i18n.getMsg('error_and')} ${maxVal}!`)
                let validVal = parseInt(userVal.replace(/\D/g, '')) ; if (isNaN(validVal)) return
                validVal = Math.max(minVal, Math.min(maxVal, validVal))
                entry.slider.value = validVal ; settings.save(entryData.key, validVal)
                sync.configToUI({ key: entryData.key })
                entry.label.textContent = `${entryData.label}: ${validVal}${ entryData.labelSuffix || '' }`
                entry.label.append(entry.editLink)
                entry.slider.style.setProperty('--track-fill-percent', `${ validVal / entry.slider.max *100 }%`)
            }
            entry.slider.oninput = ({ target: { value }}) => { // update label/color
                settings.save(entryData.key, parseInt(value)) ; sync.configToUI({ key: entryData.key })
                entry.label.textContent = `${entryData.label}: ${value}${ entryData.labelSuffix || '' }`
                entry.label.append(entry.editLink)
                entry.slider.style.setProperty('--track-fill-percent', `${ value / entry.slider.max *100 }%`)
            }
            entry.div.onwheel = ({ deltaY }) => { // move slider by 2 steps
                entry.slider.value = parseInt(entry.slider.value) - Math.sign(deltaY) *2
                entry.slider.dispatchEvent(new Event('input'))
            }
        }

        if (entryData.dependencies) { // hide/show according to toggle state
            const toDisable = Object.values(entryData.dependencies).flat().some(dep => !settings.typeIsEnabled(dep))
            Object.assign(entry.div.style, {
                transition: '', minHeight: 'auto', opacity: +!toDisable,
                height: toDisable ? 0 : 'auto', visibility: toDisable ? 'hidden' : 'visible'
            })
        }

        // Add click listener
        entry.div.onclick = async () => {
            const now = Date.now()
            const throttleMs = typeof entryData.throttle == 'number' ? entryData.throttle
                             : entryData.throttle ? 1500 : 0
            if (throttleMs && now -( entry.div.lastClickTime || 0 ) < throttleMs) return
            entry.div.classList.remove('disabled') ; entry.div.lastClickTime = now
            if (entryData.type == 'category') toggleCategorySettingsVisiblity({ key: entryData.key })
            else if (entryData.type == 'toggle') {
                entry.leftElem.classList.toggle('on')
                settings.save(entryData.key, !app.config[entryData.key])
                sync.configToUI({ key: entryData.key })
                requestAnimationFrame(() => notify(`${entryData.label} ${i18n.getMsg(`state_${
                    settings.typeIsEnabled(entryData.key) ? 'on' : 'off' }`).toUpperCase()}`))
            } else if (entryData.type == 'link') { open(entryData.url) ; close() }
            else {
                sync.configToUI({ key: entryData.key }) ; close() // popup
            }

            // Throttle re-click
            if (entryData.throttle) {
                entry.div.classList.add('disabled')
                setTimeout(() => entry.div.classList.remove('disabled'), throttleMs)
            }

            // Enable/disable dependent entries
            for (const [ctrlKey, ctrlData] of Object.entries({ ...settings.categories, ...settings.controls }))
                if (Object.values(ctrlData.dependencies || {}).flat().includes(entryData.key)) {
                    const depDiv = document.querySelector(`div#${ctrlKey}`) ; if (!depDiv) continue
                    const ctgChildren = depDiv.closest('.categorized-entries').querySelectorAll('.menu-entry'),
                          toDisable = !settings.typeIsEnabled(entryData.key)
                    requestAnimationFrame(() => Object.assign(depDiv.closest('.categorized-entries').style, {
                        height: `${dom.get.computedHeight(ctgChildren)}px`,
                        transition: env.browser?.isFF || toDisable ? '' : 'height 0.25s'
                    }))
                    Object.assign(depDiv.style, {
                        transition: toDisable ? '' : 'opacity 0.15s ease-in', height: toDisable ? 0 : 'auto',
                        visibility: toDisable ? 'hidden' : 'visible', opacity: +!toDisable
                    })
                    depDiv.classList.toggle('disabled', toDisable)
                }
        }

        return entry.div
    }

    function depIsEnabled(ctrlKey) {
        const deps = settings.controls[ctrlKey]?.dependencies
        return !deps || Object.values(deps).some(depKey => settings.typeIsEnabled(depKey))
    }

    function notify(msg, pos = !app.config.toastMode ? 'bottom-right' : undefined) {
        if (app.config.notifDisabled
            && !new RegExp(`${i18n.getMsg('menuLabel_show')} ${i18n.getMsg('menuLabel_notifs')}`, 'i')
                .test(msg)
        ) return
        sendMsgToActiveTab('notify', { msg, pos })
    }

    async function sendMsgToActiveTab(action, options) {
        const activeTabID = (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id
        return await chrome.tabs.sendMessage(activeTabID, { action, options })
    }

    const sync = {
        configToUI(options) { return sendMsgToActiveTab('syncConfigToUI', options) },

        fade() {

            // Toolbar icon
            chrome.action.setIcon({ path: Object.fromEntries(
                Object.keys(chrome.runtime.getManifest().icons).map(dimension =>
                    [dimension, `../icons/${ app.config.extensionDisabled ? 'faded/' : '' }icon${dimension}.png`]
            ))})

            // Menu elems
            document.querySelectorAll('.logo, .menu-title, .menu-entry, .slider, .categorized-entries')
                .forEach((elem, idx) => {
                    if (elem.id && (elem.matches(`#${elem.id}:has(> div.link)`) || elem.id == 'aboutEntry'))
                        return // never disable link/About entries
                    elem.style.transition = app.config.extensionDisabled ? '' : 'opacity 0.15s ease-in'
                    const toDisable = app.config.extensionDisabled || !depIsEnabled(elem.id)
                    if (elem.classList.contains('categorized-entries')) { // fade category strip
                        elem.style.transition = toDisable ? 'none' : 'var(--border-transition)'
                        elem.style.borderImage = elem.style.borderImage.replace(
                            /rgba?\(([\d,\s]+)(?:,\s*[\d.]+)?\)/,
                            `rgba($1,${ toDisable ? 0.3 : env.menu.isDark ? 0.5 : 1 })`
                        )
                    } else // fade entry
                        setTimeout(() => elem.classList.toggle('disabled', toDisable),
                            toDisable ? 0 : idx *10) // fade-out abruptly, fade-in staggered
                })
        }
    }

    function toggleCategorySettingsVisiblity({ key, transitions = true, action }) {
        const transitionDuration = 350, // ms
            ctgDiv = document.getElementById(key),
            caret = ctgDiv.querySelector('.menu-caret'),
            ctgChildrenDiv = ctgDiv.nextElementSibling,
            ctgChild = ctgChildrenDiv.querySelectorAll('.menu-entry')
        if (action != 'hide' && dom.get.computedHeight(ctgChildrenDiv) == 0) { // show category settings
            ctgDiv.classList.toggle('expanded', true)
            Object.assign(ctgChildrenDiv.style, { height: `${dom.get.computedHeight(ctgChild)}px`,
                transition: transitions && !env.browser?.isFF ? 'height 0.25s' : '' })
            Object.assign(caret.style, { // point it down
                transform: 'rotate(0deg)', transition: transitions ? 'transform 0.15s ease-out' : '' })
            ctgChild.forEach(row => { // reset styles to support continuous transition on rapid show/hide
                row.style.transition = 'none' ; row.style.opacity = 0 })
            ctgChildrenDiv.offsetHeight // force reflow to insta-apply reset
            ctgChild.forEach((row, idx) => { // fade-in staggered
                if (transitions) row.style.transition = `opacity ${ transitionDuration /1000 }s ease-in-out`
                setTimeout(() => row.style.opacity = 1, transitions ? idx * transitionDuration /10 : 0)
            })
            document.querySelectorAll(`.menu-entry:has(.menu-caret):not(#${key})`).forEach(otherCtgDiv =>
                toggleCategorySettingsVisiblity({ key: otherCtgDiv.id, action: 'hide' }))
        } else { // hide category settings
            ctgDiv.classList.toggle('expanded', false)
            Object.assign(ctgChildrenDiv.style, { height: 0, transition: '' })
            Object.assign(caret.style, { transform: 'rotate(-90deg)', transition: '' }) // point it right
        }
    }

    // Run MAIN routine

    // LOCALIZE text/titles, set document lang
    document.querySelectorAll('[data-locale-text-content], [data-locale-title]').forEach(elemToLocalize =>
        Object.entries(elemToLocalize.dataset).forEach(([dataAttr, dataVal]) => {
            if (!dataAttr.startsWith('locale')) return
            const propToLocalize = dataAttr[6].toLowerCase() + dataAttr.slice(7), // convert to valid DOM prop
                  localizedTxt = dataVal.split(' ').map(key => i18n.getMsg(key) || key).join(' ')
            elemToLocalize[propToLocalize] = localizedTxt
        })
    )
    document.documentElement.lang = chrome.i18n.getUILanguage().split('-')[0]

    // Append RISING PARTICLES styles
    ;['gray', 'white'].forEach(color => document.head.append(
        dom.create.elem('link', { rel: 'stylesheet',
            href: `https://cdn.jsdelivr.net/gh/adamlui/ai-web-extensions@71695ca/assets/styles/rising-particles/dist/${
                color}.min.css`
        })
    ))
    css.addRisingParticles(document.body, { lightScheme: env.menu.isDark ? 'white' : 'gray' })

    // Init MASTER TOGGLE
    const masterToggle = {
        div: document.querySelector('.master-toggle'),
        switch: dom.create.elem('div', { class: 'toggle menu-icon highlight-on-hover', style: 'height: 26px' }),
        track: dom.create.elem('span', { class: 'track', style: 'position: relative ; top: 7.5px' })
    }
    masterToggle.div.append(masterToggle.switch) ; masterToggle.switch.append(masterToggle.track)
    await settings.load('extensionDisabled') ; masterToggle.switch.classList.toggle('on', !app.config.extensionDisabled)
    masterToggle.div.onclick = () => {
        masterToggle.switch.classList.toggle('on') ; settings.save('extensionDisabled', !app.config.extensionDisabled)
        Object.keys(sync).forEach(key => sync[key]()) // sync fade + storage to UI
        notify(`${i18n.getMsg('appName')} 🧩 ${
                  i18n.getMsg(`state_${ app.config.extensionDisabled ? 'off' : 'on' }`).toUpperCase()}`)
    }

    // Create CHILD menu entries on YT
    const footer = document.querySelector('footer')
    if (env.site == 'youtube') {
        await settings.load(Object.keys(settings.controls))
        const menuEntriesDiv = dom.create.elem('div') ; footer.before(menuEntriesDiv)

        // Group controls by category
        const categorizedCtrls = {}
        Object.entries(settings.controls).forEach(([key, ctrl]) => {
            if (
                ctrl.excludedEnvs?.includes('chromium') && !env.browser?.isFF ||
                ctrl.excludedEnvs?.includes('firefox') && env.browser?.isFF
            ) return
            (categorizedCtrls[ctrl.category || 'general'] ??= {})[key] = { ...ctrl, key }
        })

        // Create/append general controls
        Object.values(categorizedCtrls.general || {}).forEach(ctrl => menuEntriesDiv.append(createMenuEntry(ctrl)))

        // Create/append categorized controls
        Object.entries(settings.categories).forEach(([key, category]) => {
            if (!categorizedCtrls[key]) return
            category.key = key ; category.type = 'category'
            const ctgChildrenDiv = dom.create.elem('div', { class: 'categorized-entries' })
            if (category.color) { // color the stripe
                const [r, g, b] = category.color.match(/\w\w/g).map(v => parseInt(v, 16))
                ctgChildrenDiv.style.borderImage = `linear-gradient(transparent, rgba(${r},${g},${b},${
                    env.menu.isDark ? 0.5 : 1 })) 30 100% ${ env.menu.isDark ? '/ 100' : '' }`
            }
            menuEntriesDiv.append(createMenuEntry(category), ctgChildrenDiv)
            Object.values(categorizedCtrls[key]).forEach(ctrl => ctgChildrenDiv.append(createMenuEntry(ctrl)))
        })
    }

    // Create/append ABOUT entry
    const aboutEntry = {
        div: createMenuEntry({
            key: 'aboutEntry', symbol: '💡',
            label: `${settings.getMsg('menuLabel_about')}...`,
            helptip: `${settings.getMsg('menuLabel_about')} ${settings.getMsg('appName')}`
        }),
        ticker: {
            xGap: '&emsp;&emsp;&emsp;', span: dom.create.elem('span', { class: 'ticker' }),
            innerDiv: dom.create.elem('div')
        }
    }
    aboutEntry.div.querySelector('div.menu-icon').style.paddingLeft = '10px'
    aboutEntry.div.querySelector('span').style.paddingLeft = '2.5px'
    aboutEntry.ticker.content = `${
        settings.getMsg('about_version')}: <span class="ticker-em">v${ app.version + aboutEntry.ticker.xGap }</span>`
    for (let i = 0 ; i < 7 ; i++) aboutEntry.ticker.content += aboutEntry.ticker.content // make long af
    aboutEntry.ticker.innerDiv.innerHTML = aboutEntry.ticker.content
    aboutEntry.ticker.span.append(aboutEntry.ticker.innerDiv)
    aboutEntry.div.append(aboutEntry.ticker.span) ; footer.before(aboutEntry.div)
    aboutEntry.div.onclick = () => { chrome.runtime.sendMessage({ action: 'showAbout' }) ; close() }

    // Create/append COFFEE entry
    const coffeeURL = app.urls.donate['ko-fi']
    footer.before(createMenuEntry({
        key: 'coffeeEntry', type: 'link', symbol: '☕', url: coffeeURL, favicon: true, helptip: coffeeURL,
        label: settings.getMsg('menuLabel_buyMeAcoffee')
    }))

    // Create/append REVIEW entry
    const reviewURL = app.urls.review[app.sourceWebStore]
    footer.before(createMenuEntry({
        key: 'reviewEntry', type: 'link', symbol: '⭐', url: reviewURL, helptip: reviewURL,
        label: `${settings.getMsg('btnLabel_leaveReview')}`
    }))
    document.getElementById('reviewEntry').onclick = () => { open(reviewURL) ; close() }

    // Init FOOTER
    const footerElems = { // left-to-right
        review: { span: footer.querySelector('span[data-locale-title="btnLabel_leaveReview"]') },
        coffee: { span: footer.querySelector('span[data-locale-title="menuLabel_buyMeAcoffee"]') },
        about: { span: footer.querySelector('span[data-locale-title="menuLabel_about appName"]') },
        moreExt: { span: footer.querySelector('span[data-locale-title=btnLabel_moreExtensions]') }
    }
    footerElems.review.span.append(icons.create({key: 'star', size: 13, style: 'position: relative ; top: 1px' }))
    footerElems.review.span.onclick = () => { open(reviewURL) ; close() }
    footerElems.coffee.span.append(
        icons.create({ key: 'coffeeCup', size: 23, style: 'position: relative ; left: 1px' }))
    footerElems.coffee.span.onclick = () => { open(app.urls.donate['ko-fi']) ; close() }
    footerElems.about.span.append(icons.create({ key: 'questionMark', width: 15, height: 13 }))
    footerElems.about.span.onclick = () => { chrome.runtime.sendMessage({ action: 'showAbout' }) ; close() }
    footerElems.moreExt.span.append(icons.create({ key: 'plus' }))
    footerElems.moreExt.span.onclick = () => { open(app.urls.aiweb) ; close() }

    // AUTO-EXPAND categories
    document.querySelectorAll('.menu-entry:has(.menu-caret)').forEach(ctgDiv => {
        if (settings.categories[ctgDiv.id]?.autoExpand)
            toggleCategorySettingsVisiblity({ key: ctgDiv.id, transitions: false })
    })

    // REMOVE LOADING spinner after imgs load
    Promise.all([...document.querySelectorAll('img')].map(img =>
        img.complete ? Promise.resolve() : new Promise(resolve => img.onload = resolve)
    )).then(() => {
        document.querySelectorAll('[class^=loading]').forEach(elem => elem.remove())
        sync.fade() // based on master toggle state
    })

})()
