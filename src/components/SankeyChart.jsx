import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { sankey as d3sankey, sankeyLinkHorizontal } from 'd3-sankey'
import sankeyData from '../data/sankey.json'
import { Select, SelectItem, Button, Tile, Grid, Column } from '@carbon/react'
import { Download } from '@carbon/icons-react'

export default function SankeyChart({ width = 900, height = 360 }) {
  const ref = useRef(null)
  const tooltipRef = useRef(null)
  const wrapperRef = useRef(null)
  const [data, setData] = useState(null)
  const [rawRows, setRawRows] = useState(null)
  const [lookupsMap, setLookupsMap] = useState(null)
  const [choices, setChoices] = useState({ period: [], theme: [], medium: [], affect: [] })
  const [filters, setFilters] = useState({ period: '', theme: '', medium: '', affect: '' })
  const [pinned, setPinned] = useState(null)
  const [containerWidth, setContainerWidth] = useState(width)

  // keep container width in sync using ResizeObserver for responsive rendering
  useEffect(() => {
    const el = wrapperRef.current || (ref.current && ref.current.parentElement)
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect ? entry.contentRect.width : entry.target.clientWidth
        setContainerWidth(Math.max(200, Math.floor(w)))
      }
    })
    ro.observe(el)
    // initialize
    setContainerWidth(el.clientWidth || width)
    return () => ro.disconnect()
  }, [wrapperRef.current])

  useEffect(() => {
    const container = ref.current
    const svg = d3.select(container)
    svg.selectAll('*').remove()

    // load raw CSVs on first mount
    const load = async () => {
      try {
        const [eventsMod, lookupsMod] = await Promise.all([
          import('../../data/csv/practice_events_dummy_sept25_may26.csv?raw'),
          import('../../data/csv/lookups_dummy_sept25_may26.csv?raw').catch(() => null),
        ])
        const raw = eventsMod.default || eventsMod
        const rows = d3.csvParse(raw)
        if (!rows || rows.length === 0) throw new Error('empty csv')

        const lookupRaw = lookupsMod ? (lookupsMod.default || lookupsMod) : null
        const lookups = new Map()
        if (lookupRaw) {
          d3.csvParse(lookupRaw).forEach(l => {
            const key = `${l.field}|||${l.value}`
            lookups.set(key, l.group || '')
          })
        }

        setRawRows(rows)
        setLookupsMap(lookups)

        setChoices({
          period: Array.from(new Set(rows.map(r => r.period).filter(Boolean))).sort(),
          theme: Array.from(new Set(rows.map(r => r.theme).filter(Boolean))).sort(),
          medium: Array.from(new Set(rows.map(r => r.medium).filter(Boolean))).sort(),
          affect: Array.from(new Set(rows.map(r => r.affect).filter(Boolean))).sort(),
        })
      } catch (e) {
        // fallback to prebuilt sankey JSON: extract filters if possible
        setRawRows(null)
        setData(sankeyData)
      }
    }

    if (!rawRows && !data) load()

    // render whenever rawRows / filters / size update
    const renderFromRows = () => {
      const rowsToUse = rawRows || (data ? [] : [])
      if (!rowsToUse || rowsToUse.length === 0) {
        if (data) {
          // render fallback sankeyData
        } else return
      }

      // apply filters to rows
      const filtered = (rowsToUse || []).filter(r => {
        if (filters.period && r.period !== filters.period) return false
        if (filters.theme && r.theme !== filters.theme) return false
        if (filters.medium && r.medium !== filters.medium) return false
        if (filters.affect && r.affect !== filters.affect) return false
        return true
      })

      // build aggregated links
      const linkCounts = new Map()
      const eventsByLink = new Map()
      const addLink = (s, t, ev) => {
        const key = `${s}|||${t}`
        linkCounts.set(key, (linkCounts.get(key) || 0) + 1)
        const arr = eventsByLink.get(key) || []
        arr.push(ev)
        eventsByLink.set(key, arr)
      }

      filtered.forEach(r => {
        const src = (r.source_type && r.source_type.trim()) || (r.source_label && r.source_label.trim()) || 'Unknown'
        const act = (r.practice_action && r.practice_action.trim()) || 'unknown_action'
        const out = (r.outcome_type && r.outcome_type.trim()) || 'unknown_outcome'
        addLink(src, act, r)
        addLink(act, out, r)
      })

      const threshold = 2
      const counts = new Map()
      Array.from(linkCounts.entries()).forEach(([k, v]) => {
        const [s, t] = k.split('|||')
        counts.set(s, (counts.get(s) || 0) + v)
        counts.set(t, (counts.get(t) || 0) + v)
      })

      const collapseMap = new Map()
      counts.forEach((v, k) => { if (v < threshold) collapseMap.set(k, 'Other') })

      const finalLinks = new Map()
      Array.from(linkCounts.entries()).forEach(([k, v]) => {
        const [s0, t0] = k.split('|||')
        const s = collapseMap.get(s0) || s0
        const t = collapseMap.get(t0) || t0
        const key = `${s}|||${t}`
        finalLinks.set(key, (finalLinks.get(key) || 0) + v)
      })

      const finalNodes = new Set()
      finalLinks.forEach((v, k) => {
        const [s, t] = k.split('|||')
        finalNodes.add(s)
        finalNodes.add(t)
      })

      const nodes = Array.from(finalNodes).map(id => ({ id }))
      const links = Array.from(finalLinks.entries()).map(([k, v]) => {
        const [s, t] = k.split('|||')
        const events = eventsByLink.get(`${s}|||${t}`) || []
        return { source: s, target: t, value: v, events }
      })

      // render sankey
      const renderWidth = Math.max(300, containerWidth || width)
      const color = d3.scaleOrdinal(d3.schemeTableau10)

      const sankeyGen = d3sankey()
        .nodeId(d => d.id)
        .nodeWidth(14)
        .nodePadding(18)
        .extent([[1, 1], [renderWidth - 1, height - 1]])

      const graph = sankeyGen({ nodes: nodes.map(d => Object.assign({}, d)), links: links.map(d => Object.assign({}, d)) })

      svg.attr('viewBox', `0 0 ${renderWidth} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet')
      svg.selectAll('.sankey-content').remove()
      const content = svg.append('g').attr('class', 'sankey-content')
      const zoom = d3.zoom().scaleExtent([0.5, 4]).on('zoom', (event) => { content.attr('transform', event.transform) })
      d3.select(ref.current).call(zoom)

      // LINKS with enter/update/exit and transition
      const linkSel = content.append('g').attr('fill', 'none').attr('stroke-opacity', 0.6)
        .selectAll('path').data(graph.links, d => `${d.source.id}|||${d.target.id}`)

      linkSel.join(
        enter => enter.append('path')
          .attr('d', sankeyLinkHorizontal())
          .attr('stroke', d => color(d.source.index))
          .attr('stroke-width', d => Math.max(2, d.width))
          .attr('opacity', 0)
          .call(enter => enter.transition().duration(600).attr('opacity', 0.7)),
        update => update.call(u => u.transition().duration(600).attr('d', sankeyLinkHorizontal()).attr('opacity', 0.7).attr('stroke-width', d => Math.max(2, d.width))),
        exit => exit.call(e => e.transition().duration(400).attr('opacity', 0).remove())
      )

      // NODES
      const node = content.append('g').selectAll('g').data(graph.nodes, d => d.id).join('g')

      node.append('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('height', d => Math.max(1, d.y1 - d.y0))
        .attr('width', d => Math.max(1, d.x1 - d.x0))
        .attr('fill', (d, i) => color(i))
        .attr('stroke', '#000')
        .attr('stroke-opacity', 0.08)
        .attr('opacity', 0)
        .transition().duration(600).attr('opacity', 1)
        .on('end', () => {})

      const trim = (s, n = 28) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s)

      node.append('text')
        .attr('class', 'sankey-node-label')
        .attr('x', d => d.x0 - 6)
        .attr('y', d => (d.y1 + d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .text(d => trim(d.id))
        .attr('font-family', 'Inter, Arial, Helvetica, sans-serif')
        .attr('font-size', 12)
        .filter(d => d.x0 < renderWidth / 2)
        .attr('x', d => d.x1 + 6)
        .attr('text-anchor', 'start')
        .attr('opacity', 0)
        .transition().duration(600).attr('opacity', 1)

      // interactions (tooltips + click/pin)
      content.selectAll('path').on('mouseover', (event, d) => {
        const tt = d3.select(tooltipRef.current)
        let note = ''
        if (d.events && d.events.length) {
          const withNote = d.events.find(e => e.reflexive_note && e.reflexive_note.trim())
          const ev = withNote || d.events[0]
          note = withNote ? withNote.reflexive_note : (ev.reflexive_note || `Event ${ev.id}`)
        }
        tt.style('opacity', 1).html(`<strong>${d.source.id} → ${d.target.id}</strong><br/>Value: ${d.value}<br/>${note}`)
        const [x, y] = d3.pointer(event, ref.current)
        tt.style('left', `${x + 20}px`).style('top', `${y + 20}px`)
      }).on('mousemove', (event) => {
        const tt = d3.select(tooltipRef.current)
        const [x, y] = d3.pointer(event, ref.current)
        tt.style('left', `${x + 20}px`).style('top', `${y + 20}px`)
      }).on('mouseout', () => { d3.select(tooltipRef.current).style('opacity', 0) })
        .on('click', (event, d) => { if (d.events && d.events.length) { const withNote = d.events.find(e => e.reflexive_note && e.reflexive_note.trim()); const ev = withNote || d.events[0]; setPinned(ev) } })
    }

    renderFromRows()

    return () => { svg.selectAll('*').remove() }
  }, [width, height, rawRows, filters, containerWidth, data])

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const getFilteredRows = () => {
    if (!rawRows) return []
    return rawRows.filter(r => {
      if (filters.period && r.period !== filters.period) return false
      if (filters.theme && r.theme !== filters.theme) return false
      if (filters.medium && r.medium !== filters.medium) return false
      if (filters.affect && r.affect !== filters.affect) return false
      return true
    })
  }

  const serializeSvg = () => {
    const svgEl = ref.current
    if (!svgEl) return null

    const clone = svgEl.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    clone.setAttribute('width', String(containerWidth || width))
    clone.setAttribute('height', String(height))

    const serializer = new XMLSerializer()
    let source = serializer.serializeToString(clone)
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    }

    return source
  }

  // Download CSV of currently filtered rows
  const handleDownloadCSV = () => {
    if (!rawRows) return
    const filtered = getFilteredRows()
    const csv = d3.csvFormat(filtered)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'sankey-export.csv')
  }

  const handleDownloadSVG = () => {
    const source = serializeSvg()
    if (!source) return
    downloadBlob(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), 'sankey.svg')
  }

  // Download PNG of the current SVG sankey
  const handleDownloadPNG = () => {
    const source = serializeSvg()
    if (!source) return
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    const DPR = window.devicePixelRatio || 1
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const w = (containerWidth || width)
      const h = height
      canvas.width = Math.floor(w * DPR)
      canvas.height = Math.floor(h * DPR)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      // fill background to match page
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#fff'
      ctx.fillStyle = bg.trim() || '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (!blob) return
        downloadBlob(blob, 'sankey.png')
      }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url) }
    img.src = url
  }

  return (
    <div>
      

      <div ref={wrapperRef} className="sankey-wrapper" style={{ position: 'relative', width: '100%' }}>
        <svg ref={ref} className="sankey-chart" style={{ width: '100%', height: `${height}px` }} />
        <div ref={tooltipRef} className="sankey-tooltip" style={{ position: 'absolute', pointerEvents: 'none', opacity: 0, background: 'rgba(0,0,0,0.82)', color: '#fff', padding: 10, borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.35)', fontSize: 13, maxWidth: 420, zIndex: 9999 }} />
        {pinned && (
          <Tile style={{ position: 'absolute', right: 10, bottom: 10, width: 320, maxHeight: 300, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Pinned event</strong>
              <Button size="sm" kind="ghost" onClick={() => setPinned(null)}>Close</Button>
            </div>
            <div style={{ marginTop: 8 }}>
              <div><strong>ID:</strong> {pinned.id}</div>
              <div><strong>Period:</strong> {pinned.period}</div>
              <div><strong>Theme:</strong> {pinned.theme}</div>
              <div><strong>Medium:</strong> {pinned.medium}</div>
              <div><strong>Affect:</strong> {pinned.affect}</div>
              <div style={{ marginTop: 8 }}><strong>Reflexive note</strong><div style={{ whiteSpace: 'pre-wrap' }}>{pinned.reflexive_note || '—'}</div></div>
            </div>
          </Tile>
        )}
      </div>

      {(choices && (choices.period.length > 0)) && (
        <>
        <Grid style={{ marginTop: 12, marginBottom: 8 }}>
          <Column lg={2} md={4} sm={4} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <Select id="select-period" labelText="Period" value={filters.period} onChange={e => setFilters(f => ({ ...f, period: e.target.value }))}>
              <SelectItem value="" text="All periods" />
              {choices.period.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>
          </Column>

          <Column lg={2} md={4} sm={4} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <Select id="select-theme" labelText="Theme" value={filters.theme} onChange={e => setFilters(f => ({ ...f, theme: e.target.value }))}>
              <SelectItem value="" text="All themes" />
              {choices.theme.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>
          </Column>

          <Column lg={2} md={4} sm={4} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <Select id="select-medium" labelText="Medium" value={filters.medium} onChange={e => setFilters(f => ({ ...f, medium: e.target.value }))}>
              <SelectItem value="" text="All media" />
              {choices.medium.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>
          </Column>

          <Column lg={2} md={4} sm={4} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <Select id="select-affect" labelText="Affect" value={filters.affect} onChange={e => setFilters(f => ({ ...f, affect: e.target.value }))}>
              <SelectItem value="" text="All affect" />
              {choices.affect.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>
          </Column>

          <Column lg={2} md={4} sm={4} className="filter-action-column">
            <div className="filter-action-spacer" aria-hidden="true">Reset</div>
            <Button className="filter-reset-button" size="sm" kind="secondary" onClick={() => setFilters({ period: '', theme: '', medium: '', affect: '' })}>Reset</Button>
          </Column>
        </Grid>

        <div className="export-actions">
          <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadPNG}>
            Download PNG
          </Button>
          <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadSVG}>
            Download SVG
          </Button>
          <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadCSV}>
            Download CSV
          </Button>
        </div>
        </>
      )}
    </div>
  )
}
