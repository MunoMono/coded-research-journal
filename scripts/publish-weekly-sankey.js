import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.join(__dirname, '..')
const SOURCE_CONFIG_FILE = path.join(REPO_ROOT, 'src', 'data', 'active-sankey-source.json')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  return result
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...options,
  })

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim()
    if (stderr) console.error(stderr)
    process.exit(result.status ?? 1)
  }

  return (result.stdout || '').trim()
}

function loadSourceConfig() {
  if (!fs.existsSync(SOURCE_CONFIG_FILE)) {
    console.error('Active Sankey source config not found:', SOURCE_CONFIG_FILE)
    process.exit(1)
  }

  const raw = fs.readFileSync(SOURCE_CONFIG_FILE, 'utf8')
  const parsed = JSON.parse(raw)

  return {
    eventsFile: typeof parsed.eventsFile === 'string' ? parsed.eventsFile.trim() : '',
    lookupsFile: typeof parsed.lookupsFile === 'string' ? parsed.lookupsFile.trim() : '',
  }
}

function ensureFileExists(relativePath, label) {
  if (!relativePath) {
    console.error(`Missing ${label} in active Sankey source config.`)
    process.exit(1)
  }

  const absolutePath = path.join(REPO_ROOT, relativePath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`${label} not found: ${relativePath}`)
    process.exit(1)
  }
}

function getTrackedFiles(config) {
  return [
    path.posix.join('data', 'csv', config.eventsFile),
    path.posix.join('data', 'csv', config.lookupsFile),
    path.posix.join('src', 'data', 'active-sankey-source.json'),
    path.posix.join('src', 'data', 'sankey.json'),
  ]
}

function getStatusLines() {
  const output = runCapture('git', ['status', '--short'])
  return output ? output.split('\n').filter(Boolean) : []
}

function getAllowedStatusPaths(allowedFiles) {
  return new Set(allowedFiles)
}

function getUnexpectedChanges(statusLines, allowedPaths) {
  return statusLines.filter(line => {
    const pathText = line.slice(3).trim()
    const normalizedPath = pathText.includes(' -> ')
      ? pathText.split(' -> ').at(-1)
      : pathText

    return !allowedPaths.has(normalizedPath)
  })
}

function main() {
  const commitMessage = process.argv.slice(2).join(' ').trim()

  if (!commitMessage) {
    console.error('Usage: npm run publish-weekly-sankey -- "your commit message"')
    process.exit(1)
  }

  const config = loadSourceConfig()
  ensureFileExists(path.posix.join('data', 'csv', config.eventsFile), 'events CSV')
  ensureFileExists(path.posix.join('data', 'csv', config.lookupsFile), 'lookups CSV')

  const trackedFiles = getTrackedFiles(config)
  const allowedPaths = getAllowedStatusPaths(trackedFiles)
  const initialStatus = getStatusLines()
  const unexpectedChanges = getUnexpectedChanges(initialStatus, allowedPaths)

  if (unexpectedChanges.length > 0) {
    console.error('Found changes outside the weekly Sankey publish scope:')
    unexpectedChanges.forEach(line => console.error(` - ${line}`))
    console.error('Commit or stash those changes first, then rerun this script.')
    process.exit(1)
  }

  console.log('Seeding Sankey data...')
  run('npm', ['run', 'seed'])

  console.log('Building production bundle...')
  run('npm', ['run', 'build'])

  console.log('Staging weekly Sankey files...')
  run('git', ['add', '--', ...trackedFiles])

  const postStageStatus = getStatusLines()
  const stagedScopeChanges = postStageStatus.filter(line => {
    const status = line.slice(0, 2)
    const pathText = line.slice(3).trim()
    const normalizedPath = pathText.includes(' -> ')
      ? pathText.split(' -> ').at(-1)
      : pathText

    return allowedPaths.has(normalizedPath) && status[0] !== ' '
  })

  if (stagedScopeChanges.length === 0) {
    console.log('No Sankey changes to commit.')
    return
  }

  console.log('Creating commit...')
  run('git', ['commit', '-m', commitMessage])

  console.log('Rebasing onto origin/main...')
  run('git', ['pull', '--rebase', 'origin', 'main'])

  console.log('Pushing to origin/main...')
  run('git', ['push', 'origin', 'main'])

  console.log('Deploying site...')
  run('npm', ['run', 'deploy'])

  console.log('Weekly Sankey publish complete.')
}

main()