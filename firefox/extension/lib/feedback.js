localStorage.alertQueue = '[]'
window.feedback = {

    cjsAlert(title, msg, btns, checkbox, width) {
    // [ title/msg = strings, btns = [named functions], checkbox = named function, width (px) = int ] = optional
    // * Spaces are inserted into button labels by parsing function names in camel/kebab/snake case

        const scheme = ui.getScheme(),
              isMobile = env.browser.isMobile

        const handlers = {

            dismiss: {
                click(event) {
                    if (event.target == event.currentTarget || event.target.closest('[class*=-close-btn]'))
                        dismissAlert()
                },

                key(event) {
                    if (!/^(?: |Space|Enter|Return|Esc)/.test(event.key) || ![32, 13, 27].includes(event.keyCode))
                        return
                    for (const alertId of alertQueue) { // look to handle only if triggering alert is active
                        const alert = document.getElementById(alertId)
                        if (!alert || alert.style.display == 'none') return
                        if (event.key.startsWith('Esc') || event.keyCode == 27) dismissAlert() // and do nothing
                        else { // Space/Enter pressed
                            const mainBtn = alert.querySelector('.modal-buttons').lastChild // look for main button
                            if (mainBtn) { mainBtn.click() ; event.preventDefault() } // click if found
                        }
                    }
                }
            },

            drag: {
                mousedown(event) { // find modal, update styles, attach listeners, init XY offsets
                    if ( // prevent drag when...
                        event.button != 0 // non-left-click
                        || !/auto|default/.test(getComputedStyle(event.target).cursor) // cursor changed
                    ) return
                    feedback.draggingModal = event.currentTarget
                    event.preventDefault() // prevent sub-elems like icons being draggable
                    Object.assign(feedback.draggingModal.style, {
                        transition: 'transform 0.1s ease', transform: 'scale(1.05)' })
                    document.body.style.cursor = 'grabbing' // update cursor
                    ;[...feedback.draggingModal.children] // prevent hover FX if drag lags behind cursor
                        .forEach(child => child.style.pointerEvents = 'none')
                    ;['mousemove', 'mouseup'].forEach(eventType => // add listeners
                        document.addEventListener(eventType, handlers.drag[eventType]))
                    const draggingModalRect = feedback.draggingModal.getBoundingClientRect()
                    handlers.drag.offsetX = event.clientX - draggingModalRect.left +21
                    handlers.drag.offsetY = event.clientY - draggingModalRect.top +12
                },

                mousemove(event) { // drag modal
                    if (!feedback.draggingModal) return
                    const newX = event.clientX - handlers.drag.offsetX,
                          newY = event.clientY - handlers.drag.offsetY
                    Object.assign(feedback.draggingModal.style, { left: `${newX}px`, top: `${newY}px` })
                },

                mouseup() { // restore styles/pointer events, remove listeners, reset feedback.draggingModal
                    Object.assign(feedback.draggingModal.style, { // restore styles
                        cursor: 'inherit', transition: 'inherit', transform: 'scale(1)' })
                    document.body.style.cursor = '' // restore cursor
                    ;[...feedback.draggingModal.children] // restore pointer events
                        .forEach(child => child.style.pointerEvents = '')
                    ;['mousemove', 'mouseup'].forEach(eventType => // remove listeners
                        document.removeEventListener(eventType, handlers.drag[eventType]))
                    feedback.draggingModal = null
                }
            }
        }

        // Create modal parent/children elems
        const modalContainer = document.createElement('div')
        modalContainer.id = Math.floor(randomFloat() * 1000000) + Date.now()
        modalContainer.classList.add('chatgpt-modal') // add class to main div
        const modal = document.createElement('div'),
              modalTitle = document.createElement('h2'),
              modalMsg = document.createElement('p')

        // Create/append/update modal style (if missing or outdated)
        const thisUpdated = 1739338889852 // timestamp of last edit for this file's `modalStyle`
        let modalStyle = document.querySelector('#chatgpt-modal-style') // try to select existing style
        if (!modalStyle || parseInt(modalStyle.getAttribute('last-updated'), 10) < thisUpdated) { // if missing or outdated
            if (!modalStyle) { // outright missing, create/id/attr/append it first
                modalStyle = document.createElement('style') ; modalStyle.id = 'chatgpt-modal-style'
                modalStyle.setAttribute('last-updated', thisUpdated.toString())
                document.head.append(modalStyle)
            }
            modalStyle.textContent = ( // update prev/new style contents
                `.chatgpt-modal { /* vars */
                    --transition: opacity 0.65s cubic-bezier(.165,.84,.44,1), /* for fade-in */
                                  transform 0.55s cubic-bezier(.165,.84,.44,1) ; /* for move-in */
                    --bg-transition: background-color 0.25s ease ; /* for bg dim */
                    --btn-transition: transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out ; /* for smooth zoom */
                    --btn-shadow: 2px 1px ${ scheme == 'dark' ? '54px #00cfff' : '30px #9cdaff' }}`

                + '.no-mobile-tap-outline { outline: none ; -webkit-tap-highlight-color: transparent }'

                // Background styles
                + `.chatgpt-modal {
                    pointer-events: auto ; /* override any disabling from site modals (like guest login spam) */
                    position: fixed ; top: 0 ; left: 0 ; width: 100% ; height: 100% ; /* expand to full view-port */
                    display: flex ; justify-content: center ; align-items: center ; z-index: 9999 ; /* align */
                    transition: var(--bg-transition) ; /* for bg dim */
                        -webkit-transition: var(--bg-transition) ; -moz-transition: var(--bg-transition) ;
                        -o-transition: var(--bg-transition) ; -ms-transition: var(--bg-transition) }`

                // Alert styles
                + `.chatgpt-modal > div {
                    position: absolute ; /* to be click-draggable */
                    opacity: 0 ; /* to fade-in */
                    font-family: -apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto,
                                  Oxygen-Sans, Ubuntu, Cantarell, Helvetica Neue, sans-serif ;
                    padding: 20px ; margin: 12px 23px ; font-size: 20px ;
                    color: ${ scheme == 'dark' ? 'white' : 'black' };
                    background-color: ${ scheme == 'dark' ? 'black' : 'white' };
                    border: 1px solid ${ scheme == 'dark' ? 'white' : '#b5b5b5' };
                    transform: translateX(-3px) translateY(7px) ; /* offset to move-in from */
                    max-width: 75vw ; word-wrap: break-word ; border-radius: 15px ;
                    --shadow: 0 30px 60px rgba(0,0,0,0.12) ; box-shadow: var(--shadow) ;
                        -webkit-box-shadow: var(--shadow) ; -moz-box-shadow: var(--shadow) ;
                    user-select: none ; -webkit-user-select: none ; -moz-user-select: none ;
                        -o-user-select: none ; -ms-user-select: none ;
                    transition: var(--transition) ; /* for fade-in + move-in */
                        -webkit-transition: var(--transition) ; -moz-transition: var(--transition) ;
                        -o-transition: var(--transition) ; -ms-transition: var(--transition) }
                .chatgpt-modal h2 { font-weight: bold ; font-size: 24px ; margin-bottom: 9px }
                .chatgpt-modal a { color: ${ scheme == 'dark' ? '#00cfff' : '#1e9ebb' }}
                .chatgpt-modal a:hover { text-decoration: underline }
                .chatgpt-modal.animated > div {
                    z-index: 13456 ; opacity: 0.98 ; transform: translateX(0) translateY(0) }
                @keyframes alert-zoom-fade-out {
                    0% { opacity: 1 } 50% { opacity: 0.25 ; transform: scale(1.05) }
                    100% { opacity: 0 ; transform: scale(1.35) }}`

                // Button styles
                + `.modal-buttons {
                        display: flex ; justify-content: flex-end ; margin: 20px -5px -3px 0 ;
                        ${ isMobile ? 'flex-direction: column-reverse' : '' }}
                .chatgpt-modal button {
                    font-size: 14px ; text-transform: uppercase ; cursor: crosshair ;
                    margin-left: ${ isMobile ? 0 : 10 }px ; padding: ${ isMobile ? 15 : 8 }px 18px ;
                    ${ isMobile ? 'margin-top: 5px ; margin-bottom: 3px ;' : '' }
                    border-radius: 0 ; border: 1px solid ${ scheme == 'dark' ? 'white' : 'black' };
                    transition: var(--btn-transition) ;
                        -webkit-transition: var(--btn-transition) ; -moz-transition: var(--btn-transition) ;
                        -o-transition: var(--btn-transition) ; -ms-transition: var(--btn-transition) }
                .chatgpt-modal button:hover {
                    transform: scale(1.055) ; color: black ;
                    background-color: #${ scheme == 'dark' ? '00cfff' : '9cdaff' };
                    box-shadow: var(--btn-shadow) ;
                        -webkit-box-shadow: var(--btn-shadow) ; -moz-box-shadow: var(--btn-shadow) }
                .primary-modal-btn {
                    border: 1px solid ${ scheme == 'dark' ? 'white' : 'black' };
                    background: ${ scheme == 'dark' ? 'white' : 'black' };
                    color: ${ scheme == 'dark' ? 'black' : 'white' }}
                .modal-close-btn {
                    cursor: pointer ; width: 29px ; height: 29px ; border-radius: 17px ;
                    float: right ; position: relative ; right: -6px ; top: -5px }
                .modal-close-btn svg { margin: 10px } /* center SVG for hover underlay */
                .modal-close-btn:hover { background-color: #f2f2f2${ scheme == 'dark' ? '00' : '' }}`

                // Checkbox styles
                + `.chatgpt-modal .checkbox-group { margin: 5px 0 -8px 5px }
                .chatgpt-modal input[type=checkbox] {
                    cursor: pointer ; transform: scale(0.7) ; margin-right: 5px ;
                    border: 1px solid ${ scheme == 'dark' ? 'white' : 'black' }}
                .chatgpt-modal input[type=checkbox]:checked {
                    background-color: black ; position: inherit ;
                    border: 1px solid ${ scheme == 'dark' ? 'white' : 'black' }}
                .chatgpt-modal input[type=checkbox]:focus {
                    outline: none ; box-shadow: none ; -webkit-box-shadow: none ; -moz-box-shadow: none }
                .chatgpt-modal .checkbox-group label {
                    cursor: pointer ; font-size: 14px ; color: ${ scheme == 'dark' ? '#e1e1e1' : '#1e1e1e' }}`
            )
        }

        // Insert text into elems
        modalTitle.textContent = title || '' ; modalMsg.innerText = msg || ''
        feedback.cjsRenderHTML(modalMsg)

        // Create/append buttons (if provided) to buttons div
        const modalButtons = document.createElement('div')
        modalButtons.classList.add('modal-buttons', 'no-mobile-tap-outline')
        if (btns) { // are supplied
            if (!Array.isArray(btns)) btns = [btns] // convert single button to array if necessary
            btns.forEach((buttonFn) => { // create title-cased labels + attach listeners
                const button = document.createElement('button')
                button.textContent = buttonFn.name
                    .replace(/[_-]\w/g, match => match.slice(1).toUpperCase()) // convert snake/kebab to camel case
                    .replace(/([A-Z])/g, ' $1') // insert spaces
                    .replace(/^\w/, firstChar => firstChar.toUpperCase()) // capitalize first letter
                button.onclick = () => { dismissAlert() ; buttonFn() }
                modalButtons.insertBefore(button, modalButtons.firstChild)
            })
        }

        // Create/append OK/dismiss button to buttons div
        const dismissBtn = document.createElement('button')
        dismissBtn.textContent = btns ? 'Dismiss' : 'OK'
        modalButtons.insertBefore(dismissBtn, modalButtons.firstChild)

        // Highlight primary button
        modalButtons.lastChild.classList.add('primary-modal-btn')

        // Create/append checkbox (if provided) to checkbox group div
        const checkboxDiv = document.createElement('div')
        if (checkbox) { // is supplied
            checkboxDiv.classList.add('checkbox-group')
            const checkboxFn = checkbox, // assign the named function to checkboxFn
                  checkboxInput = document.createElement('input')
            checkboxInput.type = 'checkbox' ; checkboxInput.onchange = checkboxFn

            // Create/show label
            const checkboxLabel = document.createElement('label')
            checkboxLabel.onclick = () => { checkboxInput.checked = !checkboxInput.checked ; checkboxFn() }
            checkboxLabel.textContent = checkboxFn.name[0].toUpperCase() // capitalize first char
                + checkboxFn.name.slice(1) // format remaining chars
                    .replace(/([A-Z])/g, (match, letter) => ' ' + letter.toLowerCase()) // insert spaces, convert to lowercase
                    .replace(/\b(\w+)nt\b/gi, '$1n\'t') // insert apostrophe in 'nt' suffixes
                    .trim() // trim leading/trailing spaces

            checkboxDiv.append(checkboxInput) ; checkboxDiv.append(checkboxLabel)
        }

        // Create close button
        const closeBtn = document.createElement('div')
        closeBtn.title = 'Close' ; closeBtn.classList.add('modal-close-btn', 'no-mobile-tap-outline')
        const closeSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        closeSVG.setAttribute('height', '10px')
        closeSVG.setAttribute('viewBox', '0 0 14 14')
        closeSVG.setAttribute('fill', 'none')
        const closeSVGpath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        closeSVGpath.setAttribute('fill-rule', 'evenodd')
        closeSVGpath.setAttribute('clip-rule', 'evenodd')
        closeSVGpath.setAttribute('fill', ui.getScheme() == 'dark' ? 'white' : 'black')
        closeSVGpath.setAttribute('d', 'M13.7071 1.70711C14.0976 1.31658 14.0976 0.683417 13.7071 0.292893C13.3166 -0.0976312 12.6834 -0.0976312 12.2929 0.292893L7 5.58579L1.70711 0.292893C1.31658 -0.0976312 0.683417 -0.0976312 0.292893 0.292893C-0.0976312 0.683417 -0.0976312 1.31658 0.292893 1.70711L5.58579 7L0.292893 12.2929C-0.0976312 12.6834 -0.0976312 13.3166 0.292893 13.7071C0.683417 14.0976 1.31658 14.0976 1.70711 13.7071L7 8.41421L12.2929 13.7071C12.6834 14.0976 13.3166 14.0976 13.7071 13.7071C14.0976 13.3166 14.0976 12.6834 13.7071 12.2929L8.41421 7L13.7071 1.70711Z')
        closeSVG.append(closeSVGpath) ; closeBtn.append(closeSVG)

        // Assemble/append div
        modal.append(closeBtn, modalTitle, modalMsg, checkboxDiv, modalButtons)
        modal.style.width = `${ width || 458 }px`
        modalContainer.append(modal) ; document.body.append(modalContainer)

        // Enqueue alert
        let alertQueue = JSON.parse(localStorage.alertQueue ??= JSON.stringify([]))
        alertQueue.push(modalContainer.id)
        localStorage.alertQueue = JSON.stringify(alertQueue)

        // Show alert if none active
        modalContainer.style.display = 'none'
        if (alertQueue.length == 1) {
            modalContainer.style.display = ''
            setTimeout(() => { // dim bg
                modal.parentNode.style.backgroundColor = `rgba(67,70,72,${ scheme == 'dark' ? 0.62 : 0.33 })`
                modal.parentNode.classList.add('animated')
            }, 100) // delay for transition fx
        }

        // Add listeners
        [modalContainer, closeBtn, closeSVG, dismissBtn].forEach(elem => elem.onclick = handlers.dismiss.click)
        document.addEventListener('keydown', handlers.dismiss.key)
        modal.onmousedown = handlers.drag.mousedown // enable click-dragging

        // Define alert dismisser
        const dismissAlert = () => {
            modalContainer.style.backgroundColor = 'transparent'
            modal.style.animation = 'alert-zoom-fade-out 0.165s ease-out'
            modal.onanimationend = () => {

                // Remove alert
                modalContainer.remove() // ...from DOM
                alertQueue = JSON.parse(localStorage.alertQueue)
                alertQueue.shift() // + memory
                localStorage.alertQueue = JSON.stringify(alertQueue) // + storage
                document.removeEventListener('keydown', handlers.dismiss.key) // prevent memory leaks

                // Check for pending alerts in queue
                if (alertQueue.length) {
                    const nextAlert = document.getElementById(alertQueue[0])
                    setTimeout(() => {
                        nextAlert.style.display = ''
                        setTimeout(() => nextAlert.classList.add('animated'), 100)
                    }, 500)
                }
            }
        }

        function randomFloat() {
        // * Generates a random, cryptographically secure value between 0 (inclusive) & 1 (exclusive)
            const crypto = window.crypto || window.msCrypto
            return crypto?.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF || Math.random()
        }

        return modalContainer.id // if assignment used
    },

    cjsNotify(...args) {
        const scheme = ui.getScheme()
        let msg, position, notifDuration, shadow, toast
        if (typeof args[0] == 'object' && !Array.isArray(args[0]))
            ({ msg, position, notifDuration, shadow, toast } = args[0])
        else [msg, position, notifDuration, shadow] = args
        notifDuration = notifDuration ? +notifDuration : 1.75 // sec duration to maintain notification visibility
        const fadeDuration = 0.35, // sec duration of fade-out
              vpYoffset = 23, vpXoffset = 27 // px offset from viewport border

        // Create/append notification div
        const notificationDiv = document.createElement('div') // make div
        notificationDiv.id = Math.floor(Math.random() * 1000000) + Date.now()
        notificationDiv.classList.add('chatgpt-notif')
        notificationDiv.textContent = msg // insert msg
        document.body.append(notificationDiv) // insert into DOM

        // Create/append close button
        const closeBtn = document.createElement('div')
        closeBtn.title = 'Dismiss' ; closeBtn.classList.add('notif-close-btn', 'no-mobile-tap-outline')
        const closeSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        closeSVG.setAttribute('height', '8px')
        closeSVG.setAttribute('viewBox', '0 0 14 14')
        closeSVG.setAttribute('fill', 'none')
        closeSVG.style.height = closeSVG.style.width = '8px' // override SVG styles on non-OpenAI sites
        const closeSVGpath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        closeSVGpath.setAttribute('fill-rule', 'evenodd')
        closeSVGpath.setAttribute('clip-rule', 'evenodd')
        closeSVGpath.setAttribute('fill', 'white')
        closeSVGpath.setAttribute('d', 'M13.7071 1.70711C14.0976 1.31658 14.0976 0.683417 13.7071 0.292893C13.3166 -0.0976312 12.6834 -0.0976312 12.2929 0.292893L7 5.58579L1.70711 0.292893C1.31658 -0.0976312 0.683417 -0.0976312 0.292893 0.292893C-0.0976312 0.683417 -0.0976312 1.31658 0.292893 1.70711L5.58579 7L0.292893 12.2929C-0.0976312 12.6834 -0.0976312 13.3166 0.292893 13.7071C0.683417 14.0976 1.31658 14.0976 1.70711 13.7071L7 8.41421L12.2929 13.7071C12.6834 14.0976 13.3166 14.0976 13.7071 13.7071C14.0976 13.3166 14.0976 12.6834 13.7071 12.2929L8.41421 7L13.7071 1.70711Z')
        closeSVG.append(closeSVGpath) ; closeBtn.append(closeSVG) ; notificationDiv.append(closeBtn)

        // Determine div position/quadrant
        notificationDiv.isTop = !position || !/low|bottom/i.test(position)
        notificationDiv.isRight = !position || !/left/i.test(position)
        notificationDiv.quadrant = (notificationDiv.isTop ? 'top' : 'bottom')
                                + (notificationDiv.isRight ? 'Right' : 'Left')

        // Create/append/update notification style (if missing or outdated)
        const thisUpdated = 1746996635555 // timestamp of last edit for this file's `notifStyle`
        let notifStyle = document.querySelector('#chatgpt-notif-style') // try to select existing style
        if (!notifStyle || parseInt(notifStyle.getAttribute('last-updated'), 10) < thisUpdated) { // if missing or outdated
            if (!notifStyle) { // outright missing, create/id/attr/append it first
                notifStyle = document.createElement('style') ; notifStyle.id = 'chatgpt-notif-style'
                notifStyle.setAttribute('last-updated', thisUpdated.toString())
                document.head.append(notifStyle)
            }
            notifStyle.textContent = ( // update prev/new style contents
                '.chatgpt-notif {'
                    + 'font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC",'
                        + '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", sans-serif ;'
                    + '.no-mobile-tap-outline { outline: none ; -webkit-tap-highlight-color: transparent }'
                    + 'background-color: black ; padding: 10px 13px 10px 18px ;' // bubble style
                        + 'border-radius: 11px ; border: 1px solid #f5f5f7 ;'
                    + 'opacity: 0 ; position: fixed ; z-index: 9999 ; font-size: 1.8rem ; color: white ;' // visibility
                    + 'user-select: none ; -webkit-user-select: none ; -moz-user-select: none ; -o-user-select: none ;'
                        + '-ms-user-select: none ;'
                    + `transform: translateX(${ // init off-screen for transition fx
                        !notificationDiv.isRight ? '-' : '' }35px) ;`
                    + ( shadow ? `--shadow: -8px 13px 25px 0 ${ /\b(?:shadow|on)\b/i.test(shadow) ? 'gray' : shadow };
                        box-shadow: var(--shadow) ; -webkit-box-shadow: var(--shadow) ; -moz-box-shadow: var(--shadow)`
                            : '' ) + '}'
                + `.notif-close-btn {
                    cursor: pointer ; float: right ; position: relative ; right: -4px ; margin-left: -3px ;`
                    + 'display: grid }' // top-align for non-OpenAI sites
                + '@keyframes notif-zoom-fade-out { 0% { opacity: 1 ; transform: scale(1) }' // transition out keyframes
                    + '15% { opacity: 0.35 ; transform: rotateX(-27deg) scale(1.05) }'
                    + '45% { opacity: 0.05 ; transform: rotateX(-81deg) }'
                    + '100% { opacity: 0 ; transform: rotateX(-180deg) scale(1.15) }}'
            )
            if (toast) notifStyle.textContent += `
                div.chatgpt-notif {
                    position: absolute ; left: 50% ; right: 21% !important ; text-align: center ;
                    ${ scheme == 'dark' ? 'border: 2px solid white ;' : '' }
                    margin-${ !notificationDiv.isTop ? 'bottom: 105px' : 'top: 42px' };
                    transform: translate(-50%, -50%) scale(0.6) !important }
                div.chatgpt-notif > div.notif-close-btn { top: 18px ; right: 7px ; transform: scale(2) }`
        }

        // Enqueue notification
        let notifyProps = JSON.parse(localStorage.notifyProps
            ??= JSON.stringify({ queue: { topRight: [], bottomRight: [], bottomLeft: [], topLeft: [] }}))
        notifyProps.queue[notificationDiv.quadrant].push(notificationDiv.id)
        localStorage.notifyProps = JSON.stringify(notifyProps)

        // Position notification (defaults to top-right)
        notificationDiv.style.top = notificationDiv.isTop ? vpYoffset.toString() + 'px' : ''
        notificationDiv.style.bottom = !notificationDiv.isTop ? vpYoffset.toString() + 'px' : ''
        notificationDiv.style.right = notificationDiv.isRight ? vpXoffset.toString() + 'px' : ''
        notificationDiv.style.left = !notificationDiv.isRight ? vpXoffset.toString() + 'px' : ''

        // Re-position old notifications
        const thisQuadrantQueue = notifyProps.queue[notificationDiv.quadrant]
        if (thisQuadrantQueue.length > 1) {
            try { // to move old notifications
                for (const divID of thisQuadrantQueue.slice(0, -1)) { // exclude new div
                    const oldDiv = document.getElementById(divID) ; if (!oldDiv) break
                    const offsetProp = oldDiv.style.top ? 'top' : 'bottom' // pick property to change
                    const vOffset = +parseInt(oldDiv.style[offsetProp]) +5 + oldDiv.getBoundingClientRect().height
                    oldDiv.style[offsetProp] = `${vOffset}px` // change prop
                }
            } catch (err) { console.warn('Failed to re-position notification:', err) }
        }

        // Show notification
        setTimeout(() => {
            notificationDiv.style.opacity = scheme == 'dark' ? 0.8 : 0.67 // show msg
            notificationDiv.style.transform = 'translateX(0)' // bring from off-screen
            notificationDiv.style.transition = 'transform 0.15s ease, opacity 0.15s ease'
        }, 10)

        // Init delay before hiding
        const hideDelay = fadeDuration > notifDuration ? 0 // don't delay if fade exceeds notification duration
                        : notifDuration - fadeDuration // otherwise delay for difference

        // Add notification dismissal to timeout schedule + button clicks
        const dismissNotif = () => {
            notificationDiv.style.animation = `notif-zoom-fade-out ${fadeDuration}s ease-out`
            clearTimeout(dismissFuncTID)
        }
        const dismissFuncTID = setTimeout(dismissNotif, hideDelay * 1000) // maintain visibility for `hideDelay` secs, then dismiss
        closeSVG.onclick = dismissNotif // add to close button clicks

        // Destroy notification
        notificationDiv.onanimationend = () => {
            notificationDiv.remove() // remove from DOM
            notifyProps = JSON.parse(localStorage.notifyProps)
            notifyProps.queue[notificationDiv.quadrant].shift() // + memory
            localStorage.notifyProps = JSON.stringify(notifyProps) // + storage
        }

        return notificationDiv
    },

    cjsRenderHTML(node) {
        const reTags = /<([a-z\d]+)\b([^>]*)>([\s\S]*?)<\/\1>/g,
              reAttrs = /(\S+)=['"]?((?:.(?!['"]?\s+\S+=|[>']))+.)['"]?/g, // eslint-disable-line
              nodeContent = node.childNodes

        // Preserve consecutive spaces + line breaks
        if (!feedback.cjsRenderHTML.preWrapSet) {
            node.style.whiteSpace = 'pre-wrap' ; feedback.cjsRenderHTML.preWrapSet = true
            setTimeout(() => feedback.cjsRenderHTML.preWrapSet = false, 100)
        }

        // Process child nodes
        for (const childNode of nodeContent) {

            // Process text node
            if (childNode.nodeType == Node.TEXT_NODE) {
                const text = childNode.nodeValue,
                      elems = [...text.matchAll(reTags)]

                // Process 1st element to render
                if (elems.length) {
                    const elem = elems[0],
                         [tagContent, tagName, tagAttrs, tagText] = elem.slice(0, 4),
                          tagNode = document.createElement(tagName) ; tagNode.textContent = tagText

                    // Extract/set attributes
                    const attrs = [...tagAttrs.matchAll(reAttrs)]
                    attrs.forEach(attr => {
                        const name = attr[1], val = attr[2].replace(/['"]/g, '')
                        tagNode.setAttribute(name, val)
                    })

                    const renderedNode = feedback.cjsRenderHTML(tagNode) // render child elems of newly created node

                    // Insert newly rendered node
                    const beforeTextNode = document.createTextNode(text.substring(0, elem.index)),
                          afterTextNode = document.createTextNode(text.substring(elem.index + tagContent.length))

                    // Replace text node with processed nodes
                    node.replaceChild(beforeTextNode, childNode)
                    node.insertBefore(renderedNode, beforeTextNode.nextSibling)
                    node.insertBefore(afterTextNode, renderedNode.nextSibling)
                }

            // Process element nodes recursively
            } else if (childNode.nodeType == Node.ELEMENT_NODE) feedback.cjsRenderHTML(childNode)
        }

        return node // if assignment used
    },

    notify(msg, pos = '', notifDuration = '', shadow = '') { // requires dom.js
        if (app.config.notifDisabled && !msg.includes(settings.controls.notifDisabled.label)) return

        // Strip state word to append colored one later
        const foundState = gmToolbarMenu.state.words.find(word => msg.includes(word))
        if (foundState) msg = msg.replace(foundState, '')

        // Show notification
        this.cjsNotify(`${app.symbol} ${msg}`, pos ||( app.config.notifBottom ? 'bottom' : '' ),
            notifDuration, shadow || ui.getScheme())
        const notif = document.querySelector('.chatgpt-notif:last-child')
        notif.classList.add(app.slug) // for styles.toast

        // Tweak styles
        notif.style.fontSize = '385%'
        if (foundState) { // append styled state word
            const styledStateSpan = dom.create.elem('span', { style: `color: ${
                foundState == gmToolbarMenu.state.words[0] ?
                    '#ef4848 ; text-shadow: rgba(255,169,225,0.44) 2px 1px 5px'
                  : '#5cef48 ; text-shadow: rgba(255,250,169,0.38) 2px 1px 5px'
            }`})
            styledStateSpan.append(foundState) ; notif.append(styledStateSpan)
        }
    }
};
