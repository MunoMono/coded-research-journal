#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const CSV_DIR = path.join(__dirname, '..', 'data', 'csv')
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'sankey.json')

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    // simple split - does not support quoted commas
    const cols = line.split(',').map(c => c.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] })
    return obj
  })
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

  const output = { nodes: [], links: [] }

  files.forEach(file => {
    const full = path.join(CSV_DIR, file)
    const content = fs.readFileSync(full, 'utf8')
    const rows = parseCSV(content)

    if (rows.length === 0) return

    const headers = Object.keys(rows[0])
    // detect links if headers include source,target,value
    const hasSource = headers.some(h => /source/i.test(h))
    const hasTarget = headers.some(h => /target/i.test(h))
    const hasValue = headers.some(h => /value|weight|count|amount/i.test(h))

    if (hasSource && hasTarget) {
      rows.forEach(r => {
        const src = r[headers.find(h => /source/i.test(h))]
        const tgt = r[headers.find(h => /target/i.test(h))]
        const val = Number(r[headers.find(h => /value|weight|count|amount/i.test(h))] || 1)
        output.links.push({ source: src, target: tgt, value: val })
      })
    } else if (headers.some(h => /id|name/i.test(h))) {
      // treat as nodes
      rows.forEach(r => {
        const id = r[headers.find(h => /id|name/i.test(h))]
        output.nodes.push({ id })
      })
    } else {
      // unknown schema — append as raw under nodes
      rows.forEach((r, i) => output.nodes.push({ id: `${file}-${i}`, ...r }))
    }
  })

  // if no nodes provided, derive from unique sources/targets
  if (output.nodes.length === 0 && output.links.length > 0) {
    const ids = new Set()
    output.links.forEach(l => { ids.add(l.source); ids.add(l.target) })
    output.nodes = Array.from(ids).map(id => ({ id }))
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8')
  console.log('Wrote sankey JSON to', OUT_FILE)
}

if (require.main === module) main()
