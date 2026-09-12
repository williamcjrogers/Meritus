import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { apiRequest, ApiError, setCsrf, SYNTHETIC_RESPONSE_EVENT } from './api'
import type { Session } from './types'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/Toast'
import { StatePanel } from './components/Ui'
import Login from './pages/Login'
import Watchlist from './pages/Watchlist'
import EntityDetail from './pages/EntityDetail'
import Evidence from './pages/Evidence'
import Sources from './pages/Sources'
import ReviewQueue from './pages/ReviewQueue'
import Calendar from './pages/Calendar'
import Relationships from './pages/Relationships'
import Pipeline from './pages/Pipeline'
import Reports from './pages/Reports'
import Indices from './pages/Indices'
import Imports from './pages/Imports'
import Alerts from './pages/Alerts'
import { applicationBase, isEmbedded } from './runtime'

type BootPhase = 'loading' | 'setup' | 'login' | 'ready' | 'error'

function ProtectedApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<BootPhase>('loading')
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [synthetic, setSynthetic] = useState(false)
  const [version, setVersion] = useState(0)
  const load = useCallback(() => setVersion(value => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading'); setError('')
    const boot = async () => {
      try {
        if (!isEmbedded()) {
          const status = await apiRequest<{ needs_setup: boolean }>('/api/auth/setup-status', { signal: controller.signal })
          if (status.needs_setup) { setSession(null); setExpired(false); setPhase('setup'); return }
        }
        try {
          const current = await apiRequest<Session>('/api/auth/me', { signal: controller.signal })
          setCsrf(current.csrf_token); setSession(current); setSynthetic(Boolean(current.synthetic || current.demo_mode)); setExpired(false); setPhase('ready')
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 401) { setSession(null); setExpired(true); setPhase('login'); return }
          throw reason
        }
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) { setError(reason instanceof Error ? reason.message : 'Meritus could not initialise'); setPhase('error') }
      }
    }
    boot()
    return () => controller.abort()
  }, [version])

  useEffect(() => {
    const expire = () => { setSession(null); setExpired(true); setPhase('login') }
    const markSynthetic = () => setSynthetic(true)
    window.addEventListener('meritus:unauthorised', expire)
    window.addEventListener(SYNTHETIC_RESPONSE_EVENT, markSynthetic)
    return () => { window.removeEventListener('meritus:unauthorised', expire); window.removeEventListener(SYNTHETIC_RESPONSE_EVENT, markSynthetic) }
  }, [])

  const authenticated = (current: Session) => { setSession(current); setSynthetic(Boolean(current.synthetic || current.demo_mode)); setExpired(false); setPhase('ready') }
  const logout = async () => { try { await apiRequest('/api/auth/logout', { method: 'POST' }) } finally { setSession(null); setExpired(false); setSynthetic(false); setCsrf(''); setPhase('login') } }

  if (phase === 'loading') return <main className="boot" id="main-content"><StatePanel state="loading" title="Opening Meritus" /></main>
  if (phase === 'error') return <main className="boot" id="main-content"><StatePanel state="error" title="Meritus could not start" message={error} onRetry={load} /></main>
  if (isEmbedded() && (phase === 'setup' || phase === 'login' || !session)) return <main className="boot" id="main-content"><StatePanel state="error" title="Workspace sign-in required" message="Open the Directors Workspace again to continue." onRetry={load} /><a href="/sign-in?returnTo=%2Fportal%2Fintelligence" target="_top">Sign in to the Directors Workspace</a></main>
  if (phase === 'setup') return <Login setup expired={false} onAuthenticated={authenticated} />
  if (phase === 'login' || !session) return <Login setup={false} expired={expired} onAuthenticated={authenticated} />
  return <AppShell session={session} synthetic={synthetic} onLogout={logout}><Routes><Route path="/" element={<Watchlist />} /><Route path="/entities/:id" element={<EntityDetail />} /><Route path="/evidence" element={<Evidence />} /><Route path="/sources" element={<Sources />} /><Route path="/alerts" element={<Alerts />} /><Route path="/reviews" element={<ReviewQueue />} /><Route path="/calendar" element={<Calendar />} /><Route path="/relationships" element={<Relationships />} /><Route path="/pipeline" element={<Pipeline />} /><Route path="/reports" element={<Reports />} /><Route path="/indices" element={<Indices />} /><Route path="/imports" element={<Imports />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></AppShell>
}

export default function App() { return <BrowserRouter basename={applicationBase() || '/'}><ToastProvider><ProtectedApp /></ToastProvider></BrowserRouter> }
