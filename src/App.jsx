import React, { useEffect, useMemo, useState } from 'react'
import { Theme, Grid, Column } from '@carbon/react'
import SiteHeader from './components/SiteHeader'
import SankeyChart from './components/SankeyChart'

const THEME_STORAGE_KEY = 'coded-research-journal-theme'

export default function App() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (storedTheme === 'light') return false
      if (storedTheme === 'dark') return true
    } catch {
      // Ignore storage access issues and fall back to dark mode.
    }
    return true
  })
  const [activePage, setActivePage] = useState('visualisation')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
    } catch {
      // Ignore storage access issues and keep the in-memory theme state.
    }
  }, [dark])

  const theme = useMemo(() => (dark ? 'g90' : 'g10'), [dark])
  const toggleTheme = () => setDark(current => !current)

  return (
    <Theme theme={theme}>
      <div className="app-root">
        <SiteHeader
          dark={dark}
          onToggleTheme={toggleTheme}
          activePage={activePage}
          onNavigate={setActivePage}
        />
        <main className="main-content">
          <Grid fullWidth narrow style={{ ['--cds-grid-columns']: '12' }}>
            <Column lg={12} md={8} sm={4}>
              <div className="hero">
                <h1 style={{ marginLeft: '1rem' }}>
                  {activePage === 'visualisation' ? 'Coded research journal' : 'About'}
                </h1>
              </div>

              {activePage === 'visualisation' ? (
                <section className="viz">
                  <Grid style={{ marginTop: '2rem', ['--cds-grid-columns']: '16' }}>
                    <Column lg={16} md={8} sm={4} style={{ paddingLeft: 0, paddingRight: 0 }}>
                      <SankeyChart width={1240} height={680} />
                    </Column>
                  </Grid>
                </section>
              ) : (
                <section className="about-page">
                  <Grid style={{ marginTop: '2rem' }}>
                    <Column lg={8} md={8} sm={4}>
                      <div className="about-copy">
                        <p>
                          This early-stage Sankey diagram is being developed as a reflexive visualisation of my coded research journal during the first year of PhD practice, and will continue throughout the PhD. Rather than simply listing events or activities, it starts to show how different parts of the research process connect over time. The diagram is organised in three parts: the categories on the left represent the <strong>inputs</strong> that feed the work, such as reading, supervision, conversation, making, archival investigation, or coding; the categories in the middle represent the <strong>forms of action</strong> these inputs lead into, such as documenting, mapping, testing, prototyping, or reframing; and the categories on the right represent the <strong>outcomes or effects</strong> that emerge, including insight, clarification, confidence, redirection, or further questions. In this sense, the visualisation traces not just what happened, but how research activity moves through the project.
                        </p>
                        <p>
                          The purpose of the diagram is not to claim that research happens in a neat or linear way. It does not. On the contrary, it is intended to make visible the fact that practice-based research develops through overlap, repetition, adjustment, and feedback. In this sense, the diagram acts as a reflective and reflexive tool: it helps me see where energy has been concentrated, which activities have been most productive, and how particular strands of work have influenced the direction of the project. It also offers a way of recognising parts of the research process that can be easy to overlook when writing retrospectively, such as periods of uncertainty, experimentation, dead ends, or slow conceptual shifts.
                        </p>
                        <p>
                          At this stage, both the dataset and the visual model remain provisional. The categories are still being tested and refined, and the diagram is being used not only to represent the journal but also to think with it. As more entries are added and edited, the visualisation will continue to evolve alongside the research itself. Its value lies less in producing a final map than in providing a way to reflect on how the project has been shaped in practice during the first year.
                        </p>
                      </div>
                    </Column>
                  </Grid>
                </section>
              )}
            </Column>
          </Grid>
        </main>
      </div>
    </Theme>
  )
}
