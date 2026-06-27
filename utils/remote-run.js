#!/usr/bin/env node

const { execSync } = require('child_process'),
        fs = require('fs'),
        path = require('path'),
        tmp = path.join(require('os').tmpdir(), 'bump.js')

fetch(process.argv[2])
    .then(resp => resp.text())
    .then(code => {
        code = code.replace(/^#!.*\r?\n/m, '') // strip shebang
        fs.writeFileSync(tmp, code)
        execSync(`node ${tmp} ${process.argv.slice(3).join(' ')}`, { stdio: 'inherit' })
        fs.unlinkSync(tmp)
    })
    .catch(err => console.error(err))
