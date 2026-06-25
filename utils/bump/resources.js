#!/usr/bin/env node

// Bumps @require'd JS in userscript

// NOTE: Doesn't git commit to allow script editing from breaking changes
// NOTE: Pass --cache to use script.cachePaths.userJSpath for faster init

(async () => {
    'use strict'

    const fs = require('fs'),
          path = require('path')

    const script = {
        cachePaths: { root: '.cache' },
        modes: { cache: process.argv.slice(2).some(arg => arg.startsWith('--cache')) },
        regex: {
            hash: { commit: /(@|\?v=)([^/#]+)/, sri: /[^#]+$/ },
            jsURL: /^\/\/ @require\s+(https:\/\/cdn\.jsdelivr\.net\/gh\/.+)$/,
            resName: /[^/]+\/(?:dist)?\/?[^/]+\.js(?=[?#]|$)/,
            verTag: /^v\d+\.\d+\.\d+$/
        }
    }
    script.cachePaths.bumpmjs = path.join(__dirname, `${script.cachePaths.root}/bump.min.mjs`)
    script.cachePaths.userJSpaths = path.join(__dirname, `${script.cachePaths.root}/userscript-paths.json`)

    // Import bump.mjs
    fs.mkdirSync(path.dirname(script.cachePaths.bumpmjs), { recursive: true })
    fs.writeFileSync(script.cachePaths.bumpmjs, (await (await fetch(
        'https://cdn.jsdelivr.net/gh/adamlui/ai-web-extensions@latest/utils/bump/lib/bump.min.mjs')).text()))
    const bump = await import(`file://${script.cachePaths.bumpmjs}`)
    fs.unlinkSync(script.cachePaths.bumpmjs)

    bump.log.working(`\n${ script.modes.cache ? 'Collecting' : 'Searching for' } userscripts...\n`)
    const userJSname = 'youtube-classic.user.js' ; let userJSfiles
    if (script.modes.cache) {
        try { // create missing cache file
            fs.mkdirSync(path.dirname(script.cachePaths.userJSpaths), { recursive: true })
            const fd = fs.openSync(script.cachePaths.userJSpaths,
                fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR)
            bump.log.info(`Cache file missing. Generating ${script.cachePaths.userJSpaths}...\n`)
            userJSfiles = await bump.findFileBySuffix({ suffix: userJSname }) ; console.log('')
            fs.writeFileSync(fd, JSON.stringify(userJSfiles, undefined, 2), 'utf-8')
            bump.log.success(`\nCache file created @ ${script.cachePaths.userJSpaths}`)
        } catch (err) { // use existing cache file
            userJSfiles = JSON.parse(fs.readFileSync(script.cachePaths.userJSpaths, 'utf-8'))
            console.log(userJSfiles) ; console.log('')
        }
    } else { // use bump.findFileBySuffix()
        userJSfiles = await bump.findFileBySuffix({ suffix: userJSname }) ; console.log('') }

    bump.log.working('\nCollecting resources...\n')
    const urlMap = {} ; let resCnt = 0
    userJSfiles.forEach(userJSfilePath => {
        const userJScontent = fs.readFileSync(userJSfilePath, 'utf-8'),
              resURLs = [...userJScontent.matchAll(new RegExp(script.regex.jsURL.source, 'gm'))].map(match => match[1])
        if (resURLs?.length) { urlMap[userJSfilePath] = resURLs ; resCnt += resURLs.length }
    })
    bump.log.success(`${resCnt} potentially bumpable resource(s) found.`)

    // Process each userscript
    const verCache = {}, latestCommitHashes = {}
    let urlsUpdatedCnt = 0, filesUpdatedCnt = 0
    for (const userJSfilePath of Object.keys(urlMap)) {
        const repoName = userJSfilePath.split('\\').pop().replace('.user.js', '')
        bump.log.working(`\nProcessing ${repoName}...\n`)

        // Process each resource
        let fileUpdated = false
        for (const resURL of urlMap[userJSfilePath]) {
            if (!await bump.isValidResource({ resURL, verbose: false })) continue // to next resource
            const resName = script.regex.resName.exec(resURL)?.[0] || 'resource' // dir/filename for logs

            // Compare/update commit hash
            const repoMatch = resURL.match(/gh\/([^@]+)@/)
            if (!repoMatch) {
                console.log(`Could not parse repo from ${resName}, skipping.`) ; bump.log.endedWithLineBreak = false
                continue
            }
            const targetRepo = repoMatch[1],
                  currentCommit = script.regex.hash.commit.exec(resURL)?.[2] || ''
            let resLatestVer
            if (script.regex.verTag.test(currentCommit)) { // fetch latest release
                const apiURL = `https://api.github.com/repos/${targetRepo}/releases/latest`
                resLatestVer = verCache[targetRepo] = (await (await fetch(apiURL, {
                    headers: { 'User-Agent': 'bump-script' }})).json()).tag_name
            } else if (targetRepo == `adamlui/${repoName}` && resURL.includes('firefox/extension/')) {
                if (!latestCommitHashes.firefox) {
                    console.log('Fetching latest commit hash for Firefox extension...')
                    latestCommitHashes.firefox = await bump.getLatestCommitHash({
                        repo: targetRepo, path: 'firefox/extension' })
                }
                resLatestVer = latestCommitHashes.firefox
            } else
                resLatestVer = verCache[targetRepo] ??= await bump.getLatestCommitHash({ repo: targetRepo })
            if (resLatestVer.startsWith(currentCommit)) {
                console.log(`${resName} already up-to-date!`) ; bump.log.endedWithLineBreak = false
                continue
            }
            resLatestVer = resLatestVer.substring(0, 7) // abbr it
            let updatedURL = resURL.replace(script.regex.hash.commit, `$1${resLatestVer}`) // update ref
            if (!await bump.isValidResource({ resURL: updatedURL, verbose: false })) continue // to next resource

            // Generate/compare/update SRI hash
            console.log(`${ !bump.log.endedWithLineBreak ? '\n' : '' }Generating SRI (SHA-256) hash for ${resName}...`)
            const newSRIhash = await bump.generateSRIhash({ resURL: updatedURL })
            if (script.regex.hash.sri.exec(resURL)?.[0] == newSRIhash && !script.regex.verTag.test(currentCommit)) {
                console.log(`${resName} already up-to-date!`) ; bump.log.endedWithLineBreak = false
                continue
            }
            updatedURL = updatedURL.replace(script.regex.hash.sri, newSRIhash) // update hash
            if (!await bump.isValidResource({ resURL: updatedURL, verbose: false })) continue // to next resource

            console.log(`Writing updated URL for ${resName}...`)
            const userJScontent = fs.readFileSync(userJSfilePath, 'utf-8')
            fs.writeFileSync(userJSfilePath, userJScontent.replace(resURL, updatedURL), 'utf-8')
            bump.log.success(`${resName} bumped!\n`) ; urlsUpdatedCnt++ ; fileUpdated = true
        }
        if (fileUpdated) {
            console.log(`${ !bump.log.endedWithLineBreak ? '\n' : '' }Bumping userscript version...`)
            bump.bumpVersion({ format: 'dateVer', filePath: userJSfilePath }) ; filesUpdatedCnt++
        }
    }

    bump.log[urlsUpdatedCnt ? 'success' : 'info'](
        `\n${ urlsUpdatedCnt ? 'Success! ' : '' }${
              urlsUpdatedCnt} resource(s) bumped across ${filesUpdatedCnt} file(s).`
    )

})()
