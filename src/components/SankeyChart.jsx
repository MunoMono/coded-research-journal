import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { sankey as d3sankey, sankeyLinkHorizontal } from 'd3-sankey'

export default function SankeyChart({ width = 900, height = 360 }) {
  const ref = useRef(null)
  const tooltipRef = useRef(null)

  useEffect(() => {
    const container = ref.current
    const svg = d3.select(container)
    svg.selectAll('*').remove()

    const data = {
      nodes: [
        { id: 'Source A' },
        { id: 'Source B' },
        { id: 'Intermediate' },
        { id: 'Sink 1' },
        { id: 'Sink 2' }
      ],
      links: [
        { source: 'Source A', target: 'Intermediate', value: 10 },
        { source: 'Source B', target: 'Intermediate', value: 6 },
        { source: 'Intermediate', target: 'Sink 1', value: 8 },
        { source: 'Intermediate', target: 'Sink 2', value: 8 }
      ]
    }

    const color = d3.scaleOrdinal(["#0f62fe","#0788da","#5aa700","#fa4d56","#8a3ffc"])

    const sankeyGen = d3sankey()
      .nodeId(d => d.id)
      .nodeWidth(18)
      .nodePadding(10)
      .extent([[1, 1], [width - 1, height - 1]])

    const graph = sankeyGen({ nodes: data.nodes.map(d => Object.assign({}, d)), links: data.links.map(d => Object.assign({}, d)) })

    // links
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
        tt.style('opacity', 1)
          .html(`<strong>${d.source.id} → ${d.target.id}</strong><br/>Value: ${d.value}`)
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

    // nodes
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
  }, [width, height])

  return (
    <div className="sankey-wrapper" style={{ position: 'relative' }}>
      <svg ref={ref} className="sankey-chart" />
      <div ref={tooltipRef} className="sankey-tooltip" style={{ position: 'absolute', pointerEvents: 'none', opacity: 0 }} />
    </div>
  )
}
