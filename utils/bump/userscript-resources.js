#!/usr/bin/env node

// Bumps @require'd jsDelivr URLs in userscript

// NOTE: Doesn't git commit to allow script editing from breaking changes
// NOTE: Pass --cache to use script.cache.paths.userscripts for faster init

(async () => {
    'use strict'

    const fs = require('fs'),
          path = require('path')

    const script = {
        cache: { paths: { root: '.cache' }, refs: {} },
        modes: { cache: process.argv.slice(2).some(arg => arg.startsWith('--cache')) },
        regex: {
            hash: { commit: { full: /^[a-f\d]{40}$/i, inline: /(@|\?v=)([^/#]+)/ }, sri: /[^#]+$/ },
            jsdURL: /^\/\/ @require\s+(https:\/\/cdn\.jsdelivr\.net\/gh\/.+)$/,
            resName: /[^/]+\/(?:dist)?\/?[^/]+\.js(?=[?#]|$)/,
            verTag: /^v\d+\.\d+\.\d+$/
        },
        urls: {
            bumpmjs: 'https://cdn.jsdelivr.net/gh/adamlui/ai-web-extensions/utils/bump/lib/bump.min.mjs',
            githubAPI: { repos: 'https://api.github.com/repos' }
        },
        userscriptName: 'youtube-classic.user.js'
    }
    script.cache.paths.bumpmjs = path.join(__dirname, `${script.cache.paths.root}/bump.min.mjs`)
    script.cache.paths.userscripts = path.join(__dirname, `${script.cache.paths.root}/userscripts.json`)
    const { cache: { paths: cachePaths }, regex: re } = script

    // Import bump.mjs
    fs.mkdirSync(path.dirname(cachePaths.bumpmjs), { recursive: true })
    fs.writeFileSync(cachePaths.bumpmjs, (await (await fetch(script.urls.bumpmjs)).text()))
    const bump = await import(`file://${cachePaths.bumpmjs}`)
    fs.unlinkSync(cachePaths.bumpmjs)

    bump.log.working(`\n${ script.modes.cache ? 'Collecting' : 'Searching for' } userscripts...\n`)
    let userscripts
    if (script.modes.cache) {
        try { // create missing cache file
            fs.mkdirSync(path.dirname(cachePaths.userscripts), { recursive: true })
            const fd = fs.openSync(cachePaths.userscripts,
                fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR)
            bump.log.info(`Cache file missing. Generating ${cachePaths.userscripts}...\n`)
            userscripts = await bump.findFileBySuffix({ suffix: script.userscriptName }) ; console.log('')
            fs.writeFileSync(fd, JSON.stringify(userscripts, undefined, 2), 'utf-8')
            bump.log.success(`\nCache file created @ ${cachePaths.userscripts}`)
        } catch (err) { // use existing cache file
            userscripts = JSON.parse(fs.readFileSync(cachePaths.userscripts, 'utf-8'))
            console.log(userscripts) ; console.log('')
        }
    } else { // use bump.findFileBySuffix()
        userscripts = await bump.findFileBySuffix({ suffix: script.userscriptName }) ; console.log('') }

    bump.log.working('\nCollecting resources...\n')
    const urlMap = {} ; let resCnt = 0
    userscripts.forEach(userscript => {
        const scriptContent = fs.readFileSync(userscript, 'utf-8'),
              resURLs = [...scriptContent.matchAll(new RegExp(re.jsdURL.source, 'gm'))].map(match => match[1])
        if (resURLs?.length) { urlMap[userscript] = resURLs ; resCnt += resURLs.length }
    })
    bump.log.success(`${resCnt} potentially bumpable resource(s) found.`)

    // Process each userscript
    let urlsUpdatedCnt = 0, filesUpdatedCnt = 0
    for (const scriptPath of Object.keys(urlMap)) {
        const repoName = scriptPath.split('\\').pop().replace('.user.js', '')
        bump.log.working(`\nProcessing ${repoName}...\n`)

        // Process each resource
        let fileUpdated = false
        for (const resURL of urlMap[scriptPath]) {
            if (!await bump.isValidResource({ resURL, verbose: false })) continue
            const resName = re.resName.exec(resURL)?.[0] || 'resource' // dir/filename for logs

            // Compare/update ref
            const repoMatch = resURL.match(/gh\/([^@]+)@/)
            if (!repoMatch) {
                console.log(`Could not parse repo from ${resName}, skipping.`) ; bump.log.endedWithLineBreak = false
                continue
            }
            const targetRepo = repoMatch[1],
                  currentCommit = re.hash.commit.inline.exec(resURL)?.[2] || ''
            let resLatestRef
            if (re.verTag.test(currentCommit)) { // get latest release tag
                const apiURL = `${script.urls.githubAPI.repos}/${targetRepo}/releases/latest`
                resLatestRef = script.cache.refs[targetRepo] ??= (await (await fetch(apiURL, {
                    headers: { 'User-Agent': 'bump-script' }})).json()).tag_name
            } else if (targetRepo == `adamlui/${repoName}` && resURL.includes('firefox/extension/')) {
                if (!script.cache.refs.ff) {
                    console.log('Fetching latest commit hash for firefox/extension...')
                    script.cache.refs.ff = await bump.getLatestCommitHash({
                        repo: targetRepo, path: 'firefox/extension' })
                }
                resLatestRef = script.cache.refs.ff
            } else // get latest commit hash
                resLatestRef = script.cache.refs[targetRepo] ??= await bump.getLatestCommitHash({ repo: targetRepo })
            if (resLatestRef.startsWith(currentCommit)) {
                console.log(`${resName} already up-to-date!`) ; bump.log.endedWithLineBreak = false
                continue
            } else if (re.hash.commit.full.test(resLatestRef))
                resLatestRef = resLatestRef.substring(0, 7) // truncate it
            let updatedURL = resURL.replace(re.hash.commit.inline, `$1${resLatestRef}`)
            if (!await bump.isValidResource({ resURL: updatedURL, verbose: false })) continue

            // Generate/compare/update SRI hash
            console.log(`${ !bump.log.endedWithLineBreak ? '\n' : '' }Generating SRI (SHA-256) hash for ${resName}...`)
            const newSRIhash = await bump.generateSRIhash({ resURL: updatedURL })
            if (re.hash.sri.exec(resURL)?.[0] == newSRIhash && !re.verTag.test(currentCommit)) {
                console.log(`${resName} already up-to-date!`) ; bump.log.endedWithLineBreak = false
                continue
            }
            updatedURL = updatedURL.replace(re.hash.sri, newSRIhash)
            if (!await bump.isValidResource({ resURL: updatedURL, verbose: false })) continue

            console.log(`Writing updated URL for ${resName}...`)
            const scriptContent = fs.readFileSync(scriptPath, 'utf-8')
            fs.writeFileSync(scriptPath, scriptContent.replace(resURL, updatedURL), 'utf-8')
            bump.log.success(`${resName} bumped!\n`) ; urlsUpdatedCnt++ ; fileUpdated = true
        }
        if (fileUpdated) {
            console.log(`${ !bump.log.endedWithLineBreak ? '\n' : '' }Bumping userscript version...`)
            bump.bumpVersion({ format: 'dateVer', filePath: scriptPath }) ; filesUpdatedCnt++
        }
    }

    bump.log[urlsUpdatedCnt ? 'success' : 'info'](
        `\n${ urlsUpdatedCnt ? 'Success! ' : '' }${
              urlsUpdatedCnt } resource(s) bumped across ${filesUpdatedCnt} file(s).`
    )

})()
