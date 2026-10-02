#!/usr/bin/env node

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.join(scriptDirectory, '..')

const publishDate = new Date().toISOString().slice(0, 10)
const publish = spawn('npm', [
  'run',
  'publish-weekly-sankey',
  '--',
  '--all',
  `Publish Sankey ${publishDate}`,
], {
  cwd: repositoryRoot,
  stdio: 'inherit',
})

publish.on('exit', code => {
  process.exit(code ?? 1)
})