import React from 'react'
import { Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction } from '@carbon/react'
import { Sun, Moon } from '@carbon/react/icons'

export default function SiteHeader({ dark, onToggleTheme }) {
  return (
    <Header aria-label="Reflexive practice">
      <HeaderName href="#" prefix="">
        Coded research journal
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
