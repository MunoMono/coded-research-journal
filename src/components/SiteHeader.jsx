import React from 'react'
import { Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction } from '@carbon/react'
import { Sun, Moon } from '@carbon/react/icons'

export default function SiteHeader({ dark, onToggleTheme }) {
  return (
    <Header aria-label="Reflexive practice" style={{ background: '#161616' }}>
      <HeaderName href="#" prefix="">
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 400, fontSize: '1rem' }}>Graham Newman</span>
          <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>RCA PhD coded research journal</span>
        </div>
      </HeaderName>

      <HeaderGlobalBar>
        <HeaderGlobalAction
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={dark}
          onClick={onToggleTheme}
          tooltipAlignment="end"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  )
}
