#!/usr/bin/env node

const { execFileSync } = require('child_process'),
        fs = require('fs').promises,
        os = require('os'),
        path = require('path')

fetch(process.argv[2])
    .then(resp => resp.text())
    .then(async code => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remote-run-')),
              tmpFile = path.join(tmpDir, 'script.js')
        code = code.replace(/^#!.*\r?\n/m, '') // strip shebang
        await fs.writeFile(tmpFile, code, { mode: 0o600 })
        try { execFileSync(process.execPath, [tmpFile, ...process.argv.slice(3)], { stdio: 'inherit' }) }
        finally { await fs.rm(tmpDir, { recursive: true, force: true }) }
    })
    .catch(err => console.error(err))
