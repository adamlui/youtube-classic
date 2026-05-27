// Init APP data

const ytURL = 'https://www.youtube.com'

;(async () => {
    const app = {
        version: chrome.runtime.getManifest().version,
        commitHashes: {
            data: '89b3437', // for <app|selectors|yt-exp-flags>.json
            images: 'adb4277' // for header logo
        },
        urls: { jsd: 'https://cdn.jsdelivr.net/gh/adamlui/youtube-classic' }
    }
    app.urls.assets = {
        data: `${app.urls.jsd}@${app.commitHashes.data}/assets/data`,
        images: `${app.urls.jsd}@${app.commitHashes.images}/assets/images`
    }
    const remoteAppData = await (await fetch(`${app.urls.assets.data}/app.json`)).json()
    Object.assign(app, { ...remoteAppData, urls: { ...app.urls, ...remoteAppData.urls }})
    app.sourceWebStore = 'firefox'
    app.selectors = JSON.parse(await (await fetch(`${app.urls.assets.data}/selectors.json`)).text())
    app.ui = { expFlags: JSON.parse(await (await fetch(`${app.urls.assets.data}/yt-exp-flags.json`)).text()) }
    chrome.storage.local.set({ app }) // save to browser storage
})()

// Launch YT on install
chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason == 'install') // to exclude updates
        chrome.tabs.create({ url: 'https://youtube.com' })
})

// Sync SETTINGS to activated tabs
chrome.tabs.onActivated.addListener(({ tabId }) =>
    chrome.tabs.sendMessage(tabId, { action: 'syncConfigToUI' }))

// Open YT or menu on ACION icon click
chrome.action.onClicked.addListener(async ({ url }) => {
    if (!/^https?:\/\/(?:[^.]+\.)?youtube\.com(?:\/|$)/.test(url))
        return chrome.tabs.create({ url: ytURL })
    await chrome.action.setPopup({ popup: 'popup/index.html' })
    await chrome.action.openPopup()
    await chrome.action.setPopup({ popup: '' })
})

// Show ABOUT modal when toolbar menu button clicked
chrome.runtime.onMessage.addListener(async ({ action }) => {
    if (action == 'showAbout') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        chrome.tabs.sendMessage(activeTab.id, { action: 'showAbout', source: 'service-worker.js' })
    }
})
