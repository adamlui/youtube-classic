#!/usr/bin/env node

const { execFileSync } = require('child_process'),
        fs = require('fs'),
        os = require('os'),
        path = require('path')

fetch(process.argv[2])
    .then(resp => resp.text())
    .then(code => {
        code = code.replace(/^#!.*\r?\n/m, '') // strip shebang
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-run-')),
              tmpFile = path.join(tmpDir, 'script.js')
        try {
            fs.writeFileSync(tmpFile, code, { encoding: 'utf8', mode: 0o600 })
            execFileSync(process.execPath, [tmpFile, ...process.argv.slice(3)], { stdio: 'inherit' })
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })
    .catch(err => console.error(err))
