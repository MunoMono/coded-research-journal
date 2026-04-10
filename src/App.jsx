import React, { useEffect, useMemo, useState } from 'react'
import { Theme, Grid, Column } from '@carbon/react'
import SiteHeader from './components/SiteHeader'
import SankeyChart from './components/SankeyChart'

export default function App() {
  const [dark, setDark] = useState(false)
  const [activePage, setActivePage] = useState('visualisation')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
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
                      <h4 className="about-copy">
                        This early-stage Sankey diagram is being developed as a reflexive visualisation of my coded research journal during the first year of PhD practice. Rather than simply recording events, it begins to trace how inputs, actions, and outcomes move through my research process, showing how reading, making, testing, reflection, and feedback inform one another over time. At this stage, the project is provisional and exploratory: the visual structure is being tested alongside the dataset itself, allowing both the categories and the representation to evolve together as the journal is further populated and refined.
                      </h4>
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
