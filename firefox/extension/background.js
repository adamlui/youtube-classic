// Init APP data
(async () => {
    const app = {
        version: chrome.runtime.getManifest().version,
        commitHashes: {
            data: 'd02e303', // for <app|selectors|yt-exp-flags>.json
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
