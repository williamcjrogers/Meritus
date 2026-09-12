import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Session } from '../types'
import { Button } from './Ui'
import { isEmbedded } from '../runtime'

const navigation = [
  ['/', 'Watchlist'], ['/evidence', 'Evidence'], ['/sources', 'Sources'], ['/reviews', 'Review queue'], ['/alerts', 'Alerts'], ['/calendar', 'Calendar'],
  ['/relationships', 'Relationships'], ['/pipeline', 'Pipeline'], ['/reports', 'Reports'], ['/indices', 'Indices'], ['/imports', 'Imports'],
] as const

export function AppShell({ session, synthetic, onLogout, children }: { session: Session; synthetic: boolean; onLogout: () => void; children: ReactNode }) {
  if (isEmbedded()) return <div className="shell shell-embedded" id="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><nav className="embedded-navigation" aria-label="Analyst desk">{navigation.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}</nav><div className="work-surface">{synthetic && <div className="authenticity authenticity-demo authenticity-persistent" role="status"><strong>Demo data</strong><span>This session includes an explicitly marked synthetic response.</span></div>}{children}</div></div>
  return <div className="shell" id="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><aside className="rail"><div className="brand"><span className="brand-mark" aria-hidden="true">M</span><div><strong>Meritus</strong><small>Signal engine</small></div></div><nav aria-label="Analyst desk">{navigation.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}</nav><div className="operator"><span>Signed in as</span><strong>{session.username}</strong><Button emphasis="ghost" onClick={onLogout}>Sign out</Button></div></aside><div className="work-surface">{synthetic && <div className="authenticity authenticity-demo authenticity-persistent" role="status"><strong>Demo data</strong><span>This session includes an explicitly marked synthetic response.</span></div>}{children}</div></div>
}
