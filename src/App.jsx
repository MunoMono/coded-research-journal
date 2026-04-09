import React, { useEffect, useRef, useState } from 'react'
import SiteHeader from './components/SiteHeader'
import * as d3 from 'd3'
import SankeyChart from './components/SankeyChart'

export default function App() {
  const svgRef = useRef(null)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg
      .attr('viewBox', '0 0 400 120')
      .append('circle')
      .attr('cx', 200)
      .attr('cy', 60)
      .attr('r', 40)
      .attr('fill', '#0f62fe')
  }, [])

  const toggleTheme = () => setDark(d => !d)

  return (
    <div className="app-root">
      <SiteHeader dark={dark} onToggleTheme={toggleTheme} />
      <main className="main-content">
        <div className="hero">
          <h1>Coded research journal</h1>
          <p>Landing page built with Carbon, Vite, React and d3.</p>
        </div>

        <section className="viz">
          <h2>Example d3 placeholder</h2>
          <svg ref={svgRef} width="100%" height="120" />
          <div style={{marginTop: '2rem'}}>
            <h2>Sankey example</h2>
            <SankeyChart width={900} height={360} />
          </div>
        </section>
      </main>
    </div>
  )
}
