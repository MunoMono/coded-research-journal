import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_DIR = path.join(__dirname, '..', 'data', 'csv')
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'sankey.json')

// Very small CSV parser - for robust parsing swap to a CSV library
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] })
    return obj
  }).filter(row => Object.values(row).some(value => String(value || '').trim()))
}

function aggregateLinks(links) {
  const map = new Map()
  links.forEach(l => {
    const key = `${l.source}|||${l.target}`
    if (!map.has(key)) map.set(key, { source: l.source, target: l.target, value: 0, events: [] })
    const entry = map.get(key)
    entry.value += l.value || 1
    if (l.event) entry.events.push(l.event)
  })
  return Array.from(map.values())
}

function main() {
  if (!fs.existsSync(CSV_DIR)) {
    console.error('CSV folder not found:', CSV_DIR)
    process.exit(1)
  }

  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'))
  if (files.length === 0) {
    console.error('No CSV files found in', CSV_DIR)
    process.exit(1)
  }

  // expecting `practice_events.csv` and `lookups.csv`
  const eventsFile = files.find(f => /practice_events/i.test(f))
  const lookupsFile = files.find(f => /lookups/i.test(f))

  const output = { nodes: [], links: [], filters: { period: [], theme: [], medium: [], affect: [] }, rawEvents: [] }

  // parse lookups as optional reference (not required for Sankey linking)
  if (lookupsFile) {
    const content = fs.readFileSync(path.join(CSV_DIR, lookupsFile), 'utf8')
    // keep for now - future use
    output.lookups = parseCSV(content)
  }

  if (!eventsFile) {
    console.error('No practice_events CSV found in', CSV_DIR)
    process.exit(1)
  }

  const csv = fs.readFileSync(path.join(CSV_DIR, eventsFile), 'utf8')
  const rows = parseCSV(csv)

  // iterate rows and build links: input -> action, action -> output
  const rawLinks = []
  const nodeSet = new Set()

  rows.forEach((r, idx) => {
    const sourceType = r['source_type'] || ''
    const sourceLabel = r['source_label'] || r['source'] || ''
    const inputId = sourceLabel ? `${sourceType}:${sourceLabel}` : sourceType || 'Unknown Input'

    const action = r['practice_action'] || r['action'] || 'Unknown Action'
    const outputType = r['outcome_type'] || r['outcome'] || 'Unknown Outcome'

    // event metadata
    const event = {
      id: r['id'] || `evt-${idx}`,
      period: r['period'] || r['date'] || '',
      theme: r['theme'] || '',
      medium: r['medium'] || '',
      affect: r['affect'] || '',
      reflexive_note: r['reflexive_note'] || r['note'] || '',
      source_type: sourceType,
      source_label: sourceLabel,
      practice_action: action,
      outcome_type: outputType,
    }

    output.rawEvents.push(event)

    // update filters
    if (event.period && !output.filters.period.includes(event.period)) output.filters.period.push(event.period)
    if (event.theme && !output.filters.theme.includes(event.theme)) output.filters.theme.push(event.theme)
    if (event.medium && !output.filters.medium.includes(event.medium)) output.filters.medium.push(event.medium)
    if (event.affect && !output.filters.affect.includes(event.affect)) output.filters.affect.push(event.affect)

    // nodes
    nodeSet.add(inputId)
    nodeSet.add(action)
    nodeSet.add(outputType)

    // link input -> action
    rawLinks.push({ source: inputId, target: action, value: 1, event })
    // link action -> output
    rawLinks.push({ source: action, target: outputType, value: 1, event })
  })

  output.nodes = Array.from(nodeSet).map(id => ({ id }))
  output.links = aggregateLinks(rawLinks)

  // sort filter values
  Object.keys(output.filters).forEach(k => output.filters[k].sort())

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8')
  console.log('Wrote sankey JSON to', OUT_FILE)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
