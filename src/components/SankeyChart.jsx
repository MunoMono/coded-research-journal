import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { sankey as d3sankey, sankeyLinkHorizontal } from 'd3-sankey'
import sankeyData from '../data/sankey.json'
import { Select, SelectItem, Button, Tile } from '@carbon/react'

export default function SankeyChart({ width = 900, height = 360 }) {
  const ref = useRef(null)
  const tooltipRef = useRef(null)
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ period: '', theme: '', medium: '', affect: '' })
  const [pinned, setPinned] = useState(null)

  useEffect(() => {
    // load generated sankey JSON via static import to respect Vite base path
    setData(sankeyData)
  }, [])

  useEffect(() => {
    const container = ref.current
    const svg = d3.select(container)
    svg.selectAll('*').remove()

    if (!data) return

    // apply filters to links by checking event metadata
    const filteredLinks = data.links.filter(l => {
      if (!l.events || l.events.length === 0) return false
      return l.events.some(ev => {
        if (filters.period && ev.period !== filters.period) return false
        if (filters.theme && ev.theme !== filters.theme) return false
        if (filters.medium && ev.medium !== filters.medium) return false
        if (filters.affect && ev.affect !== filters.affect) return false
        return true
      })
    })

    // derive nodes from filtered links
    const nodeIds = new Set()
    filteredLinks.forEach(l => { nodeIds.add(l.source); nodeIds.add(l.target) })
    const nodes = Array.from(nodeIds).map(id => ({ id }))

    const graphData = { nodes, links: filteredLinks }

    const color = d3.scaleOrdinal(["#0f62fe", "#0788da", "#5aa700", "#fa4d56", "#8a3ffc"])

    const sankeyGen = d3sankey()
      .nodeId(d => d.id)
      .nodeWidth(18)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 1]])

    const graph = sankeyGen({ nodes: graphData.nodes.map(d => Object.assign({}, d)), links: graphData.links.map(d => Object.assign({}, d)) })

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    const link = svg.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.5)
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => color(d.source.index))
      .attr('stroke-width', d => Math.max(1, d.width))
      .on('mouseover', (event, d) => {
        const tt = d3.select(tooltipRef.current)
        // prefer reflexive_note from linked events
        let note = ''
        if (d.events && d.events.length) {
          const withNote = d.events.find(e => e.reflexive_note && e.reflexive_note.trim())
          const ev = withNote || d.events[0]
          note = withNote ? withNote.reflexive_note : (ev.reflexive_note || `Event ${ev.id}`)
        }
        tt.style('opacity', 1)
          .html(`<strong>${d.source.id} → ${d.target.id}</strong><br/>Value: ${d.value}<br/>${note}`)
        const [x, y] = d3.pointer(event, container)
        tt.style('left', `${x + 20}px`).style('top', `${y + 20}px`)
        d3.select(event.currentTarget).attr('stroke-opacity', 0.9)
      })
      .on('mousemove', (event) => {
        const tt = d3.select(tooltipRef.current)
        const [x, y] = d3.pointer(event, container)
        tt.style('left', `${x + 20}px`).style('top', `${y + 20}px`)
      })
      .on('mouseout', (event) => {
        d3.select(tooltipRef.current).style('opacity', 0)
        d3.select(event.currentTarget).attr('stroke-opacity', 0.5)
      })
      .on('click', (event, d) => {
        if (d.events && d.events.length) {
          const withNote = d.events.find(e => e.reflexive_note && e.reflexive_note.trim())
          const ev = withNote || d.events[0]
          setPinned(ev)
        }
      })

    const node = svg.append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g')

    node.append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('height', d => Math.max(1, d.y1 - d.y0))
      .attr('width', d => Math.max(1, d.x1 - d.x0))
      .attr('fill', (d, i) => color(i))
      .attr('stroke', '#000')
      .attr('stroke-opacity', 0.1)
      .on('mouseover', (event, d) => {
        d3.select(tooltipRef.current).style('opacity', 1).html(`<strong>${d.id}</strong><br/>${d.value || ''}`)
        const [x, y] = d3.pointer(event, container)
        d3.select(tooltipRef.current).style('left', `${x + 20}px`).style('top', `${y + 20}px`)
      })
      .on('mousemove', (event) => {
        const [x, y] = d3.pointer(event, container)
        d3.select(tooltipRef.current).style('left', `${x + 20}px`).style('top', `${y + 20}px`)
      })
      .on('mouseout', () => {
        d3.select(tooltipRef.current).style('opacity', 0)
      })

    node.append('text')
      .attr('x', d => d.x0 - 6)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text(d => d.id)
      .attr('font-family', 'Inter, Arial, Helvetica, sans-serif')
      .attr('font-size', 12)
      .filter(d => d.x0 < width / 2)
      .attr('x', d => d.x1 + 6)
      .attr('text-anchor', 'start')

    return () => {
      svg.selectAll('*').remove()
    }
  }, [width, height, data, filters])

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
        {data && (
          <>
            <Select id="select-period" labelText="Period" value={filters.period} onChange={e => setFilters(f => ({ ...f, period: e.target.value }))}>
              <SelectItem value="" text="All periods" />
              {data.filters.period.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>

            <Select id="select-theme" labelText="Theme" value={filters.theme} onChange={e => setFilters(f => ({ ...f, theme: e.target.value }))}>
              <SelectItem value="" text="All themes" />
              {data.filters.theme.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>

            <Select id="select-medium" labelText="Medium" value={filters.medium} onChange={e => setFilters(f => ({ ...f, medium: e.target.value }))}>
              <SelectItem value="" text="All media" />
              {data.filters.medium.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>

            <Select id="select-affect" labelText="Affect" value={filters.affect} onChange={e => setFilters(f => ({ ...f, affect: e.target.value }))}>
              <SelectItem value="" text="All affect" />
              {data.filters.affect.map(p => <SelectItem key={p} value={p} text={p} />)}
            </Select>

            <Button size="sm" kind="secondary" onClick={() => setFilters({ period: '', theme: '', medium: '', affect: '' })}>Reset</Button>
          </>
        )}
      </div>

      <div className="sankey-wrapper" style={{ position: 'relative' }}>
        <svg ref={ref} className="sankey-chart" style={{ width: '100%', height: `${height}px` }} />
        <div ref={tooltipRef} className="sankey-tooltip" style={{ position: 'absolute', pointerEvents: 'none', opacity: 0, background: 'var(--cds-ui-background)', padding: 8, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
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
    </div>
  )
}
