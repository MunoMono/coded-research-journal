import React from 'react'
import { Header, HeaderName, HeaderGlobalBar, HeaderGlobalAction, HeaderNavigation, HeaderMenuItem } from '@carbon/react'
import { Moon, Sun } from '@carbon/icons-react'

export default function SiteHeader({ dark, onToggleTheme, activePage, onNavigate }) {
  const isDark = !!dark

  return (
    <Header aria-label="Reference Library">
      <HeaderName href="#" prefix="">
        Graham Newman RCA PhD
      </HeaderName>

      <HeaderNavigation aria-label="Primary navigation">
        <HeaderMenuItem
          href="#visualisation"
          isCurrentPage={activePage === 'visualisation'}
          aria-current={activePage === 'visualisation' ? 'page' : undefined}
          onClick={event => {
            event.preventDefault()
            onNavigate('visualisation')
          }}
        >
          Visualisation
        </HeaderMenuItem>
        <HeaderMenuItem
          href="#about"
          isCurrentPage={activePage === 'about'}
          aria-current={activePage === 'about' ? 'page' : undefined}
          onClick={event => {
            event.preventDefault()
            onNavigate('about')
          }}
        >
          About
        </HeaderMenuItem>
      </HeaderNavigation>

      <HeaderGlobalBar>
        <HeaderGlobalAction
          aria-label="Toggle theme"
          onClick={onToggleTheme}
          tooltipAlignment="end"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  )
}
