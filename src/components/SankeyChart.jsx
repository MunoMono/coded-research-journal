import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { sankey as d3sankey, sankeyLinkHorizontal } from 'd3-sankey'
import activeSankeySource from '../data/active-sankey-source.json'
import sankeyData from '../data/sankey.json'
import { Select, SelectItem, Button, Tile, Grid, Column, Search, DatePicker, DatePickerInput } from '@carbon/react'
import { Download, Maximize, Minimize } from '@carbon/icons-react'

const rawCsvModules = import.meta.glob('../../data/csv/*.csv', { query: '?raw', import: 'default' })

export default function SankeyChart({ width = 900, height = 360 }) {
  const ref = useRef(null)
  const tooltipRef = useRef(null)
  const wrapperRef = useRef(null)
  const colorScaleRef = useRef(d3.scaleOrdinal(d3.schemeTableau10))
  const emptyFilters = {
    input: '',
    action: '',
    outcome: '',
    period: '',
    series: '',
    theme: '',
    medium: '',
    affect: '',
  }
  const [data, setData] = useState(null)
  const [rawRows, setRawRows] = useState(null)
  const [seededPracticeEventsCsv, setSeededPracticeEventsCsv] = useState('')
  const [seededLookupsCsv, setSeededLookupsCsv] = useState('')
  const [lookupsMap, setLookupsMap] = useState(() => new Map())
  const [choices, setChoices] = useState({
    input: [],
    action: [],
    outcome: [],
    period: [],
    series: [],
    theme: [],
    medium: [],
    affect: [],
  })
  const [filters, setFilters] = useState(emptyFilters)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [pinned, setPinned] = useState(null)
  const [dateRange, setDateRange] = useState({ start: null, end: null })
  const [datePickerKey, setDatePickerKey] = useState(0)
  const [containerWidth, setContainerWidth] = useState(width)
  const [fullscreen, setFullscreen] = useState(false)
  const isCompactLayout = containerWidth < 672

  const normalizeLookupText = value => (value == null ? '' : String(value).trim())
  const buildLookupKey = (field, value) => `${normalizeLookupText(field)}|||${normalizeLookupText(value)}`
  const createLookupMeta = (field, value, row = {}) => {
    const normalizedField = normalizeLookupText(field)
    const normalizedValue = normalizeLookupText(value)

    return {
      field: normalizedField,
      value: normalizedValue,
      label: normalizeLookupText(row.label) || normalizedValue,
      group: normalizeLookupText(row.group),
      description: normalizeLookupText(row.description),
    }
  }
  const getLookupMeta = (field, value, sourceMap = lookupsMap) => {
    const normalizedField = normalizeLookupText(field)
    const normalizedValue = normalizeLookupText(value)
    return sourceMap.get(buildLookupKey(normalizedField, normalizedValue)) || createLookupMeta(normalizedField, normalizedValue)
  }
  const normalizeEventRow = row => ({
    ...row,
    reflexive_note: normalizeLookupText(row?.reflexive_note) || normalizeLookupText(row?.['reflexive note']),
  })
  const isEmptyRow = row => !Object.values(row || {}).some(value => normalizeLookupText(value))
  const getSeriesValue = row => {
    const explicitSeries = normalizeLookupText(row.series)
    if (explicitSeries) return explicitSeries
    const eventId = normalizeLookupText(row.id)
    if (!eventId) return ''
    if (/^Y\d+-P\d+$/i.test(eventId)) return 'practice'
    if (/^Y\d+-J\d+$/i.test(eventId)) return 'journal'
    return 'journal'
  }
  const getRowFieldValue = (row, field) => (field === 'series' ? getSeriesValue(row) : normalizeLookupText(row[field]))
  const getInputValue = row => normalizeLookupText(row.source_type) || normalizeLookupText(row.source_label)
  const makeNodeId = (stage, field, value) => `${stage}|||${field}|||${value}`
  const getNodeIdsForRow = row => {
    const sourceType = normalizeLookupText(row?.source_type)
    const sourceLabel = normalizeLookupText(row?.source_label)
    const sourceField = sourceType ? 'source_type' : 'source_label'
    const sourceValue = sourceType || sourceLabel || 'Unknown'
    const actionValue = normalizeLookupText(row?.practice_action) || 'unknown_action'
    const outcomeValue = normalizeLookupText(row?.outcome_type) || 'unknown_outcome'

    return {
      sourceId: makeNodeId('source', sourceField, sourceValue),
      actionId: makeNodeId('action', 'practice_action', actionValue),
      outcomeId: makeNodeId('outcome', 'outcome_type', outcomeValue),
    }
  }
  const formatTags = value => normalizeLookupText(value)
    .split(';')
    .map(tag => tag.trim())
    .filter(Boolean)
    .join(', ')
  const buildFilterChoices = (rows, field, sourceMap = lookupsMap) => Array.from(
    new Set(rows.map(row => getRowFieldValue(row, field)).filter(Boolean))
  )
    .map(value => getLookupMeta(field, value, sourceMap))
    .sort((left, right) => {
      const groupCompare = (left.group || '').localeCompare(right.group || '')
      if (groupCompare !== 0) return groupCompare
      const labelCompare = (left.label || '').localeCompare(right.label || '')
      if (labelCompare !== 0) return labelCompare
      return (left.value || '').localeCompare(right.value || '')
    })

  const parseCsvDate = dateStr => {
    if (!dateStr) return null
    const parts = String(dateStr).trim().split('/')
    if (parts.length !== 3) return null
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const yearRaw = parseInt(parts[2], 10)
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    const d = new Date(year, month, day)
    return isNaN(d.getTime()) ? null : d
  }

  const buildInputChoices = (rows, sourceMap = lookupsMap) => Array.from(
    new Set(rows.map(row => getInputValue(row)).filter(Boolean))
  )
    .map(value => getLookupMeta('source_type', value, sourceMap))
    .sort((left, right) => left.label.localeCompare(right.label))
  const rowMatchesFilters = row => {
    if (filters.input && getInputValue(row) !== filters.input) return false
    if (filters.action && normalizeLookupText(row.practice_action) !== filters.action) return false
    if (filters.outcome && normalizeLookupText(row.outcome_type) !== filters.outcome) return false
    if (filters.period && normalizeLookupText(row.period) !== filters.period) return false
    if (filters.series && getSeriesValue(row) !== filters.series) return false
    if (filters.theme && normalizeLookupText(row.theme) !== filters.theme) return false
    if (filters.medium && normalizeLookupText(row.medium) !== filters.medium) return false
    if (filters.affect && normalizeLookupText(row.affect) !== filters.affect) return false
    if (dateRange.start || dateRange.end) {
      const rowDate = parseCsvDate(normalizeLookupText(row.date))
      if (!rowDate) return false
      if (dateRange.start) {
        const start = new Date(dateRange.start)
        start.setHours(0, 0, 0, 0)
        if (rowDate < start) return false
      }
      if (dateRange.end) {
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        if (rowDate > end) return false
      }
    }
    return true
  }
  const buildSearchText = row => [
    row.id,
    row.date,
    row.period,
    row.source_type,
    row.source_label,
    row.practice_action,
    row.outcome_type,
    row.theme,
    row.medium,
    row.affect,
    row.reflexive_note,
    row.evidence_link,
    row.tags,
    getSeriesValue(row),
  ].map(normalizeLookupText).join(' ').toLowerCase()
  const filteredRows = useMemo(() => (rawRows ? rawRows.filter(rowMatchesFilters) : []), [rawRows, filters, dateRange])
  const selectedEvent = useMemo(() => {
    if (!rawRows || !selectedEventId) return null
    return rawRows.find(row => normalizeLookupText(row.id) === selectedEventId) || null
  }, [rawRows, selectedEventId])
  const selectedEventNodeIds = useMemo(() => {
    if (!selectedEvent) return new Set()
    const { sourceId, actionId, outcomeId } = getNodeIdsForRow(selectedEvent)
    return new Set([sourceId, actionId, outcomeId])
  }, [selectedEvent])
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!rawRows || !query) return []
    return rawRows
      .filter(row => buildSearchText(row).includes(query))
      .slice(0, 8)
  }, [rawRows, searchQuery])
  const selectedEventVisible = useMemo(() => {
    if (!selectedEventId) return false
    return filteredRows.some(row => normalizeLookupText(row.id) === selectedEventId)
  }, [filteredRows, selectedEventId])
  const handleSelectEvent = row => {
    const eventId = normalizeLookupText(row?.id)
    setPinned(row || null)
    setSelectedEventId(eventId)
  }

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
    svg.selectAll('*').interrupt()

    // load raw CSVs on first mount
    const load = async () => {
      try {
        const eventsPath = `../../data/csv/${activeSankeySource.eventsFile}`
        const lookupsPath = `../../data/csv/${activeSankeySource.lookupsFile}`
        const loadEventsCsv = rawCsvModules[eventsPath]
        const loadLookupsCsv = rawCsvModules[lookupsPath]

        if (!loadEventsCsv) {
          throw new Error(`configured events CSV not found: ${activeSankeySource.eventsFile}`)
        }

        const [eventsMod, lookupsMod] = await Promise.all([
          loadEventsCsv(),
          loadLookupsCsv ? loadLookupsCsv().catch(() => null) : Promise.resolve(null),
        ])
        const raw = eventsMod.default || eventsMod
        const rows = d3.csvParse(raw)
          .map(normalizeEventRow)
          .filter(row => !isEmptyRow(row))
        if (!rows || rows.length === 0) throw new Error('empty csv')

        const lookupRaw = lookupsMod ? (lookupsMod.default || lookupsMod) : null
        const lookups = new Map()
        if (lookupRaw) {
          d3.csvParse(lookupRaw).forEach(l => {
            const field = normalizeLookupText(l.field)
            const value = normalizeLookupText(l.value)
            if (!field || !value) return
            const key = buildLookupKey(field, value)
            lookups.set(key, createLookupMeta(field, value, l))
          })
        }

        setRawRows(rows)
        setSeededPracticeEventsCsv(raw)
        setSeededLookupsCsv(lookupRaw || '')
        setLookupsMap(lookups)

        setChoices({
          input: buildInputChoices(rows, lookups),
          action: buildFilterChoices(rows, 'practice_action', lookups),
          outcome: buildFilterChoices(rows, 'outcome_type', lookups),
          period: buildFilterChoices(rows, 'period', lookups),
          series: buildFilterChoices(rows, 'series', lookups),
          theme: buildFilterChoices(rows, 'theme', lookups),
          medium: buildFilterChoices(rows, 'medium', lookups),
          affect: buildFilterChoices(rows, 'affect', lookups),
        })
      } catch (e) {
        // fallback to prebuilt sankey JSON: extract filters if possible
        setRawRows(null)
        setSeededPracticeEventsCsv('')
        setSeededLookupsCsv('')
        setLookupsMap(new Map())
        setData(sankeyData)
      }
    }

    if (!rawRows && !data) load()

    // render whenever rawRows / filters / size update
    const renderFromRows = () => {
      if (!rawRows && !data) return
      // Use filteredRows (dropdown + date filters applied) when CSV is loaded
      const filtered = rawRows ? filteredRows : []
      if (!filtered || filtered.length === 0) {
        if (data) {
          // render fallback sankeyData
        } else {
          // clear the SVG when no rows match the active filters
          d3.select(ref.current).selectAll('*').remove()
          return
        }
      }

      // build aggregated links
      const linkCounts = new Map()
      const eventsByLink = new Map()
      const linkSeparator = '>>>>'
      const parseNodeId = nodeId => {
        const [stage = '', field = '', ...valueParts] = nodeId.split('|||')
        return {
          stage,
          field,
          value: valueParts.join('|||'),
        }
      }
      const getNodeMeta = nodeId => {
        const { stage, field, value } = parseNodeId(nodeId)
        return {
          stage,
          ...getLookupMeta(field, value),
        }
      }
      const makeLinkKey = (source, target) => `${source}${linkSeparator}${target}`
      const parseLinkKey = key => key.split(linkSeparator)
      const addLink = (s, t, ev) => {
        const key = makeLinkKey(s, t)
        linkCounts.set(key, (linkCounts.get(key) || 0) + 1)
        const arr = eventsByLink.get(key) || []
        arr.push(ev)
        eventsByLink.set(key, arr)
      }

      filtered.forEach(r => {
        const sourceType = normalizeLookupText(r.source_type)
        const sourceLabel = normalizeLookupText(r.source_label)
        const sourceField = sourceType ? 'source_type' : 'source_label'
        const sourceValue = sourceType || sourceLabel || 'Unknown'
        const actionValue = normalizeLookupText(r.practice_action) || 'unknown_action'
        const outcomeValue = normalizeLookupText(r.outcome_type) || 'unknown_outcome'

        const src = makeNodeId('source', sourceField, sourceValue)
        const act = makeNodeId('action', 'practice_action', actionValue)
        const out = makeNodeId('outcome', 'outcome_type', outcomeValue)
        addLink(src, act, r)
        addLink(act, out, r)
      })

      const threshold = 1
      const counts = new Map()
      Array.from(linkCounts.entries()).forEach(([k, v]) => {
        const [s, t] = parseLinkKey(k)
        counts.set(s, (counts.get(s) || 0) + v)
        counts.set(t, (counts.get(t) || 0) + v)
      })

      const collapseMap = new Map()
      counts.forEach((v, k) => {
        if (v < threshold) {
          const { stage = 'other', field = '' } = parseNodeId(k)
          collapseMap.set(k, makeNodeId(stage, field, 'Other'))
        }
      })

      const finalLinks = new Map()
      const finalEventsByLink = new Map()
      Array.from(linkCounts.entries()).forEach(([k, v]) => {
        const [s0, t0] = parseLinkKey(k)
        const s = collapseMap.get(s0) || s0
        const t = collapseMap.get(t0) || t0
        const key = makeLinkKey(s, t)
        finalLinks.set(key, (finalLinks.get(key) || 0) + v)
        const arr = finalEventsByLink.get(key) || []
        arr.push(...(eventsByLink.get(k) || []))
        finalEventsByLink.set(key, arr)
      })

      const finalNodes = new Set()
      finalLinks.forEach((v, k) => {
        const [s, t] = parseLinkKey(k)
        finalNodes.add(s)
        finalNodes.add(t)
      })

      const nodes = Array.from(finalNodes).map(id => ({ id, ...getNodeMeta(id) }))
      const links = Array.from(finalLinks.entries()).map(([k, v]) => {
        const [s, t] = parseLinkKey(k)
        const events = finalEventsByLink.get(k) || []
        return { source: s, target: t, value: v, events }
      })

      // render sankey
      const renderWidth = Math.max(280, containerWidth || width)
      const renderHeight = isCompactLayout ? Math.max(420, Math.min(height, Math.round(renderWidth * 1.12))) : height
      const labelFontSize = isCompactLayout ? 10 : 12
      const labelTrim = isCompactLayout ? 18 : 28
      const color = colorScaleRef.current
      const trim = (s, n = labelTrim) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s)
      const getLabelX = d => (d.x0 < renderWidth / 2 ? d.x1 + 6 : d.x0 - 6)
      const getLabelAnchor = d => (d.x0 < renderWidth / 2 ? 'start' : 'end')
      const hasSelectedEvent = Boolean(selectedEventId)
      const linkContainsSelectedEvent = link => hasSelectedEvent && link.events && link.events.some(eventRow => normalizeLookupText(eventRow.id) === selectedEventId)
      const nodeIsOnSelectedPath = node => !hasSelectedEvent || selectedEventNodeIds.has(node.id)

      const sankeyGen = d3sankey()
        .nodeId(d => d.id)
        .nodeWidth(14)
        .nodePadding(isCompactLayout ? 14 : 18)
        .extent([[1, 1], [renderWidth - 1, renderHeight - 1]])

      const graph = sankeyGen({ nodes: nodes.map(d => Object.assign({}, d)), links: links.map(d => Object.assign({}, d)) })

      svg.attr('viewBox', `0 0 ${renderWidth} ${renderHeight}`).attr('preserveAspectRatio', 'xMidYMid meet')
      const content = svg.selectAll('.sankey-content').data([null]).join('g').attr('class', 'sankey-content')
      const linkLayer = content.selectAll('.sankey-links').data([null]).join('g').attr('class', 'sankey-links').attr('fill', 'none').attr('stroke-opacity', 0.6)
      const nodeLayer = content.selectAll('.sankey-nodes').data([null]).join('g').attr('class', 'sankey-nodes')
      const labelLayer = content.selectAll('.sankey-labels').data([null]).join('g').attr('class', 'sankey-labels')
      const layoutTransition = svg.transition().duration(700).ease(d3.easeCubicInOut)
      const zoom = d3.zoom().scaleExtent([0.5, 4]).on('zoom', (event) => { content.attr('transform', event.transform) })
      d3.select(ref.current).call(zoom)

      const linkSel = linkLayer.selectAll('path').data(graph.links, d => `${d.source.id}|||${d.target.id}`)
      const linkEnter = linkSel.enter()
        .append('path')
        .attr('class', 'sankey-link')
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke', d => color(d.source.id))
        .attr('stroke-linecap', 'butt')
        .attr('stroke-width', 0)
        .attr('opacity', 0)

      linkEnter.merge(linkSel)
        .transition(layoutTransition)
        .delay(d => Math.min(220, d.source.x0 * 0.35))
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke', d => color(d.source.id))
        .attr('stroke-width', d => {
          const baseWidth = Math.max(2, d.width)
          return linkContainsSelectedEvent(d) ? baseWidth + 2 : baseWidth
        })
        .attr('opacity', d => {
          if (!hasSelectedEvent) return 0.72
          return linkContainsSelectedEvent(d) ? 0.96 : 0.14
        })

      linkSel.exit()
        .transition()
        .duration(320)
        .ease(d3.easeCubicIn)
        .attr('stroke-width', 0)
        .attr('opacity', 0)
        .remove()

      const nodeSel = nodeLayer.selectAll('g').data(graph.nodes, d => d.id)
      const nodeEnter = nodeSel.enter()
        .append('g')
        .attr('class', 'sankey-node')
        .attr('transform', d => `translate(${d.x0},${(d.y0 + d.y1) / 2})`)
        .attr('opacity', 0)

      nodeEnter.append('rect')
        .attr('width', d => Math.max(1, d.x1 - d.x0))
        .attr('height', 0)
        .attr('fill', d => color(d.id))
        .attr('stroke', '#000')
        .attr('stroke-opacity', 0.08)
        .attr('rx', 1.5)
        .attr('ry', 1.5)

      nodeEnter.append('title')

      const nodeMerge = nodeEnter.merge(nodeSel)

      nodeMerge.select('title')
        .text(d => [d.label, d.group, d.description].filter(Boolean).join('\n'))

      nodeMerge
        .transition(layoutTransition)
        .delay(d => Math.min(260, d.x0 * 0.45))
        .attr('transform', d => `translate(${d.x0},${d.y0})`)
        .attr('opacity', d => (nodeIsOnSelectedPath(d) ? 1 : 0.4))

      nodeMerge.select('rect')
        .transition(layoutTransition)
        .delay(d => Math.min(260, d.x0 * 0.45))
        .attr('width', d => Math.max(1, d.x1 - d.x0))
        .attr('height', d => Math.max(1, d.y1 - d.y0))
        .attr('fill', d => color(d.id))
        .attr('opacity', d => (nodeIsOnSelectedPath(d) ? 1 : 0.4))

      nodeSel.exit()
        .transition()
        .duration(320)
        .ease(d3.easeCubicIn)
        .attr('opacity', 0)
        .remove()

      nodeSel.exit().select('rect')
        .transition()
        .duration(320)
        .ease(d3.easeCubicIn)
        .attr('height', 0)

      const labelSel = labelLayer.selectAll('text').data(graph.nodes, d => d.id)
      const labelEnter = labelSel.enter()
        .append('text')
        .attr('class', 'sankey-node-label')
        .attr('x', d => getLabelX(d))
        .attr('y', d => (d.y1 + d.y0) / 2 + 10)
        .attr('dy', '0.35em')
        .attr('text-anchor', d => getLabelAnchor(d))
        .attr('font-family', 'Inter, Arial, Helvetica, sans-serif')
        .attr('font-size', labelFontSize)
        .attr('opacity', 0)

      labelEnter.merge(labelSel)
        .text(d => trim(d.label))
        .transition(layoutTransition)
        .delay(d => 120 + Math.min(220, d.x0 * 0.35))
        .attr('x', d => getLabelX(d))
        .attr('y', d => (d.y1 + d.y0) / 2)
        .attr('text-anchor', d => getLabelAnchor(d))
        .attr('font-size', labelFontSize)
        .attr('opacity', d => (nodeIsOnSelectedPath(d) ? 1 : 0.4))

      labelSel.exit()
        .transition()
        .duration(220)
        .ease(d3.easeCubicIn)
        .attr('opacity', 0)
        .remove()

      // interactions (tooltips + click/pin)
      linkLayer.selectAll('path').on('mouseover', (event, d) => {
        const tt = d3.select(tooltipRef.current)
        let activeEvent = null
        let note = ''
        let evidenceLink = ''
        let tags = ''
        if (d.events && d.events.length) {
          const withNote = d.events.find(e => e.reflexive_note && e.reflexive_note.trim())
          activeEvent = withNote || d.events[0]
          note = withNote ? withNote.reflexive_note : (activeEvent.reflexive_note || `Event ${activeEvent.id}`)
          evidenceLink = normalizeLookupText(activeEvent.evidence_link)
          tags = formatTags(activeEvent.tags)
        }
        tt.style('opacity', 1).html([
          `<strong>${d.source.label} → ${d.target.label}</strong>`,
          `Value: ${d.value}`,
          activeEvent?.source_label ? `Source label: ${activeEvent.source_label}` : '',
          note ? `Reflexive note: ${note}` : '',
          evidenceLink ? `Evidence: ${evidenceLink}` : '',
          tags ? `Tags: ${tags}` : '',
        ].filter(Boolean).join('<br/>'))
        const [x, y] = d3.pointer(event, ref.current)
        tt.style('left', `${x + 20}px`).style('top', `${y + 20}px`)
      }).on('mousemove', (event) => {
        const tt = d3.select(tooltipRef.current)
        const [x, y] = d3.pointer(event, ref.current)
        tt.style('left', `${x + 20}px`).style('top', `${y + 20}px`)
      }).on('mouseout', () => { d3.select(tooltipRef.current).style('opacity', 0) })
        .on('click', (event, d) => {
          if (d.events && d.events.length) {
            const withNote = d.events.find(e => e.reflexive_note && e.reflexive_note.trim())
            const ev = withNote || d.events[0]
            handleSelectEvent(ev)
          }
        })
    }

    renderFromRows()

    return () => { svg.selectAll('*').interrupt() }
  }, [width, height, filteredRows, containerWidth, data, lookupsMap, selectedEventId, selectedEventNodeIds])

  useEffect(() => {
    if (!fullscreen) return
    const handleKeyDown = (e) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreen])

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
    return filteredRows
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

  const downloadCsvText = (csvText, filename) => {
    if (!csvText) return
    downloadBlob(new Blob([csvText], { type: 'text/csv;charset=utf-8;' }), filename)
  }

  const handleDownloadPracticeEventsCsv = () => {
    if (seededPracticeEventsCsv) {
      downloadCsvText(seededPracticeEventsCsv, 'practice_events_seed.csv')
      return
    }

    if (!rawRows) return
    downloadCsvText(d3.csvFormat(rawRows), 'practice_events_seed.csv')
  }

  const handleDownloadLookupsCsv = () => {
    if (seededLookupsCsv) {
      downloadCsvText(seededLookupsCsv, 'lookups_seed.csv')
      return
    }

    const lookupRows = Array.from(lookupsMap.values()).map(({ field, value, label, group, description }) => ({
      field,
      value,
      label,
      group,
      description,
    }))
    if (lookupRows.length === 0) return

    downloadCsvText(d3.csvFormat(lookupRows), 'lookups_seed.csv')
  }

  // Download CSV of currently filtered rows
  const handleDownloadFilteredCsv = () => {
    if (!rawRows) return
    const filtered = getFilteredRows()
    const csv = d3.csvFormat(filtered)
    downloadCsvText(csv, 'sankey-export.csv')
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
      const h = isCompactLayout ? Math.max(420, Math.min(height, Math.round(w * 1.12))) : height
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
      <div ref={wrapperRef} className={`sankey-wrapper${fullscreen ? ' sankey-wrapper--fullscreen' : ''}`} style={{ position: 'relative', width: '100%' }}>
        <svg ref={ref} className="sankey-chart" style={{ width: '100%', height: `${isCompactLayout ? Math.max(420, Math.min(height, Math.round((containerWidth || width) * 1.12))) : height}px` }} />
        <div ref={tooltipRef} className="sankey-tooltip" style={{ position: 'absolute', pointerEvents: 'none', opacity: 0, background: 'rgba(0,0,0,0.82)', color: '#fff', padding: 10, borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.35)', fontSize: 13, maxWidth: isCompactLayout ? Math.max(220, (containerWidth || width) - 32) : 420, zIndex: 9999 }} />
        <button
          className="sankey-expand-btn"
          onClick={() => setFullscreen(f => !f)}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Expand to fullscreen'}
        >
          {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
        {pinned && (
          <Tile className="sankey-pinned-tile" style={{ position: isCompactLayout ? 'static' : 'absolute', right: isCompactLayout ? 'auto' : 10, bottom: isCompactLayout ? 'auto' : 10, width: isCompactLayout ? '100%' : 320, maxWidth: isCompactLayout ? '100%' : 320, marginTop: isCompactLayout ? 12 : 0, maxHeight: isCompactLayout ? 'none' : 300, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Pinned event</strong>
              <Button size="sm" kind="ghost" onClick={() => setPinned(null)}>Close</Button>
            </div>
            <div style={{ marginTop: 8 }}>
              <div><strong>ID:</strong> {pinned.id}</div>
              <div><strong>Period:</strong> {getLookupMeta('period', pinned.period).label}</div>
              <div><strong>Series:</strong> {getLookupMeta('series', getSeriesValue(pinned)).label}</div>
              <div><strong>Theme:</strong> {getLookupMeta('theme', pinned.theme).label}</div>
              <div><strong>Medium:</strong> {getLookupMeta('medium', pinned.medium).label}</div>
              <div><strong>Affect:</strong> {getLookupMeta('affect', pinned.affect).label}</div>
              <div><strong>Evidence:</strong> {pinned.evidence_link || '—'}</div>
              <div><strong>Tags:</strong> {formatTags(pinned.tags) || '—'}</div>
              <div style={{ marginTop: 8 }}><strong>Reflexive note</strong><div style={{ whiteSpace: 'pre-wrap' }}>{pinned.reflexive_note || '—'}</div></div>
            </div>
          </Tile>
        )}
      </div>

      {(choices && (choices.period.length > 0)) && (
        <div className="controls-panel">
          <section className="controls-section" aria-labelledby="filters-heading">
            <div className="controls-section-header">
              <h2 id="filters-heading" className="controls-heading">Filters</h2>
            </div>
            <Grid className="controls-grid">
              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-input" labelText="Input" value={filters.input} onChange={e => setFilters(f => ({ ...f, input: e.target.value }))}>
                  <SelectItem value="" text="All inputs" />
                  {choices.input.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-action" labelText="Action" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
                  <SelectItem value="" text="All actions" />
                  {choices.action.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-outcome" labelText="Outcome" value={filters.outcome} onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))}>
                  <SelectItem value="" text="All outcomes" />
                  {choices.outcome.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-period" labelText="Period" value={filters.period} onChange={e => setFilters(f => ({ ...f, period: e.target.value }))}>
                  <SelectItem value="" text="All periods" />
                  {choices.period.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-series" labelText="Series" value={filters.series} onChange={e => setFilters(f => ({ ...f, series: e.target.value }))}>
                  <SelectItem value="" text="All series" />
                  {choices.series.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-theme" labelText="Theme" value={filters.theme} onChange={e => setFilters(f => ({ ...f, theme: e.target.value }))}>
                  <SelectItem value="" text="All themes" />
                  {choices.theme.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-medium" labelText="Medium" value={filters.medium} onChange={e => setFilters(f => ({ ...f, medium: e.target.value }))}>
                  <SelectItem value="" text="All media" />
                  {choices.medium.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-control-column">
                <Select id="select-affect" labelText="Affect" value={filters.affect} onChange={e => setFilters(f => ({ ...f, affect: e.target.value }))}>
                  <SelectItem value="" text="All affect" />
                  {choices.affect.map(choice => <SelectItem key={choice.value} value={choice.value} text={choice.label} title={choice.description || choice.group || choice.label} />)}
                </Select>
              </Column>

              <Column lg={2} md={4} sm={4} className="filter-action-column">
                <div className="filter-action-spacer" aria-hidden="true">Reset</div>
                <Button className="filter-reset-button" size="sm" kind="secondary" onClick={() => { setFilters(emptyFilters); setDateRange({ start: null, end: null }); setDatePickerKey(k => k + 1) }}>Reset</Button>
              </Column>
            </Grid>
          </section>

          <div className="controls-keyline" aria-hidden="true" />

          {rawRows && (
            <section className="controls-section event-search-panel" aria-labelledby="row-search-heading">
              <div className="event-search-header">
                <h2 id="row-search-heading" className="controls-heading">Row search</h2>
                {selectedEventId ? (
                  <Button size="sm" kind="ghost" onClick={() => { setSelectedEventId(''); setPinned(null) }}>
                    Clear focus
                  </Button>
                ) : null}
              </div>
              <Search
                id="event-search"
                className="event-search-input"
                labelText="Search rows"
                placeholder="Search ID, note, tag, source, or evidence"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                size="lg"
              />
              <p className="event-search-meta">
                {searchQuery.trim()
                  ? `${searchResults.length}${searchResults.length === 1 ? ' match' : ' matches'} shown from all entries.`
                  : 'Search across all journal, practice, and writing entries.'}
              </p>
              <div className="event-date-range">
                <DatePicker
                  key={datePickerKey}
                  datePickerType="range"
                  dateFormat="d/m/y"
                  onChange={dates => {
                    const [start = null, end = null] = dates
                    setDateRange({ start: start || null, end: end || null })
                  }}
                >
                  <DatePickerInput
                    id="date-range-start"
                    placeholder="dd/mm/yy"
                    labelText="From date"
                    size="lg"
                  />
                  <DatePickerInput
                    id="date-range-end"
                    placeholder="dd/mm/yy"
                    labelText="To date"
                    size="lg"
                  />
                </DatePicker>
                {(dateRange.start || dateRange.end) && (
                  <Button
                    size="sm"
                    kind="ghost"
                    className="date-range-clear"
                    onClick={() => { setDateRange({ start: null, end: null }); setDatePickerKey(k => k + 1) }}
                  >
                    Clear dates
                  </Button>
                )}
              </div>
              {selectedEvent && !selectedEventVisible ? (
                <div className="event-search-warning">
                  <span>The selected row is currently hidden by the active filters.</span>
                  <Button size="sm" kind="secondary" onClick={() => setFilters(emptyFilters)}>
                    Reset filters to reveal it
                  </Button>
                </div>
              ) : null}
              {searchResults.length > 0 ? (
                <div className="event-search-results" role="list">
                  {searchResults.map(row => {
                    const rowId = normalizeLookupText(row.id)
                    const isActive = rowId === selectedEventId
                    return (
                      <button
                        key={rowId}
                        type="button"
                        className={`event-search-result${isActive ? ' is-active' : ''}`}
                        onClick={() => handleSelectEvent(row)}
                      >
                        <span className="event-search-result-topline">
                          <strong>{row.id}</strong>
                          <span>{row.date}</span>
                          <span>{getLookupMeta('series', getSeriesValue(row)).label}</span>
                        </span>
                        <span className="event-search-result-body">
                          {row.source_label || getLookupMeta('source_type', row.source_type).label}
                        </span>
                        <span className="event-search-result-meta">
                          {[
                            getLookupMeta('source_type', row.source_type).label,
                            getLookupMeta('theme', row.theme).label,
                            getLookupMeta('outcome_type', row.outcome_type).label,
                          ].filter(Boolean).join(' • ')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )}

          <div className="controls-keyline" aria-hidden="true" />

          <section className="controls-section" aria-labelledby="downloads-heading">
            <div className="controls-section-header">
              <h2 id="downloads-heading" className="controls-heading">Downloads</h2>
            </div>
            <div className="export-actions">
              <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadPNG}>
                Download PNG
              </Button>
              <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadSVG}>
                Download SVG
              </Button>
              <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadFilteredCsv}>
                Download filtered CSV
              </Button>
              <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadPracticeEventsCsv}>
                Download practice events CSV
              </Button>
              <Button className="export-action-button" kind="tertiary" size="md" renderIcon={Download} onClick={handleDownloadLookupsCsv}>
                Download lookups CSV
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
