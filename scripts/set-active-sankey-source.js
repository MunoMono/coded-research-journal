import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_DIR = path.join(__dirname, '..', 'data', 'csv')
const SOURCE_CONFIG_FILE = path.join(__dirname, '..', 'src', 'data', 'active-sankey-source.json')
const SEED_SCRIPT = path.join(__dirname, 'csv-to-json.js')

function readSourceConfig() {
  if (!fs.existsSync(SOURCE_CONFIG_FILE)) {
    return { eventsFile: '', lookupsFile: '' }
  }

  const raw = fs.readFileSync(SOURCE_CONFIG_FILE, 'utf8')
  const parsed = JSON.parse(raw)

  return {
    eventsFile: typeof parsed.eventsFile === 'string' ? parsed.eventsFile.trim() : '',
    lookupsFile: typeof parsed.lookupsFile === 'string' ? parsed.lookupsFile.trim() : '',
  }
}

function writeSourceConfig(config) {
  fs.writeFileSync(SOURCE_CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function listEventFiles() {
  if (!fs.existsSync(CSV_DIR)) {
    console.error('CSV folder not found:', CSV_DIR)
    process.exit(1)
  }

  return fs.readdirSync(CSV_DIR)
    .filter(file => file.endsWith('.csv') && /practice_events/i.test(file))
    .sort()
}

function validateFileName(fileName, availableFiles) {
  if (!fileName) {
    console.error('No CSV filename provided.')
    process.exit(1)
  }

  if (!availableFiles.includes(fileName)) {
    console.error(`CSV not found: ${fileName}`)
    console.error('Available practice_events CSV files:')
    availableFiles.forEach(file => console.error(` - ${file}`))
    process.exit(1)
  }
}

function askQuestion(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close()
      resolve(answer)
    })
  })
}

function rebuildSankey() {
  const result = spawnSync(process.execPath, [SEED_SCRIPT], { stdio: 'inherit' })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function main() {
  const availableFiles = listEventFiles()
  if (availableFiles.length === 0) {
    console.error('No practice_events CSV files found in', CSV_DIR)
    process.exit(1)
  }

  const currentConfig = readSourceConfig()
  const argFileName = process.argv[2]?.trim()

  console.log('Available practice_events CSV files:')
  availableFiles.forEach(file => {
    const marker = file === currentConfig.eventsFile ? ' (current)' : ''
    console.log(` - ${file}${marker}`)
  })

  let selectedFile = argFileName
  if (!selectedFile) {
    const prompt = currentConfig.eventsFile
      ? `Enter the events CSV filename to use for the Sankey [${currentConfig.eventsFile}]: `
      : 'Enter the events CSV filename to use for the Sankey: '

    const answer = (await askQuestion(prompt)).trim()
    selectedFile = answer || currentConfig.eventsFile
  }

  validateFileName(selectedFile, availableFiles)

  writeSourceConfig({
    eventsFile: selectedFile,
    lookupsFile: currentConfig.lookupsFile || 'lookups_sept25_july26_updated.csv',
  })

  console.log(`Updated active Sankey events CSV to ${selectedFile}`)
  rebuildSankey()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})