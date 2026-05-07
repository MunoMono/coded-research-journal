import React, { useEffect, useMemo, useState } from 'react'
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  HeaderNavigation,
  HeaderMenuButton,
  HeaderMenuItem,
  SideNav,
  SideNavItems,
  SideNavLink,
} from '@carbon/react'
import { Moon, Sun } from '@carbon/icons-react'

export default function SiteHeader({ dark, onToggleTheme, activePage, onNavigate }) {
  const isDark = !!dark
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false)
  const navItems = useMemo(() => ([
    { id: 'visualisation', href: '#visualisation', label: 'Visualisation' },
    { id: 'about', href: '#about', label: 'About' },
  ]), [])

  useEffect(() => {
    setIsSideNavExpanded(false)
  }, [activePage])

  const handleNavigate = page => event => {
    event.preventDefault()
    setIsSideNavExpanded(false)
    onNavigate(page)
  }

  return (
    <>
      <Header aria-label="Reference Library">
        <HeaderMenuButton
          aria-label={isSideNavExpanded ? 'Close navigation menu' : 'Open navigation menu'}
          isCollapsible
          isActive={isSideNavExpanded}
          onClick={() => setIsSideNavExpanded(current => !current)}
        />

        <HeaderName href="#" prefix="">
          Graham Newman RCA PhD
        </HeaderName>

        <HeaderNavigation aria-label="Primary navigation">
          {navItems.map(item => (
            <HeaderMenuItem
              key={item.id}
              href={item.href}
              isActive={activePage === item.id}
              aria-current={activePage === item.id ? 'page' : undefined}
              onClick={handleNavigate(item.id)}
            >
              {item.label}
            </HeaderMenuItem>
          ))}
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

      <SideNav
        aria-label="Mobile navigation"
        expanded={isSideNavExpanded}
        isPersistent={false}
        onOverlayClick={() => setIsSideNavExpanded(false)}
        onSideNavBlur={() => setIsSideNavExpanded(false)}
      >
        <SideNavItems>
          {navItems.map(item => (
            <SideNavLink
              key={item.id}
              href={item.href}
              isActive={activePage === item.id}
              onClick={handleNavigate(item.id)}
            >
              {item.label}
            </SideNavLink>
          ))}
        </SideNavItems>
      </SideNav>
    </>
  )
}
