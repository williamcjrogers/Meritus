import { useRef, useState, type FormEvent } from 'react'
import { authenticate } from '../api'
import type { Session } from '../types'
import { Button, FormError, TextField } from '../components/Ui'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Login({ setup, expired, onAuthenticated }: { setup: boolean; expired: boolean; onAuthenticated: (session: Session) => void }) {
  usePageTitle(setup ? 'Set up' : 'Sign in')
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [visible, setVisible] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const userRef = useRef<HTMLInputElement>(null); const passwordRef = useRef<HTMLInputElement>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!username.trim()) { setError('Enter your username.'); userRef.current?.focus(); return }
    if (password.length < (setup ? 12 : 1)) { setError(setup ? 'Use at least 12 characters for the first operator password.' : 'Enter your password.'); passwordRef.current?.focus(); return }
    setBusy(true)
    try { onAuthenticated(await authenticate(setup ? 'setup' : 'login', username.trim(), password)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Authentication failed'); passwordRef.current?.focus() } finally { setBusy(false) }
  }
  return <main className="login-page" id="main-content"><section className="login-intro"><span className="brand-mark" aria-hidden="true">M</span><p className="eyebrow">Construction intelligence</p><h1>{setup ? 'Set up Meritus' : 'Return to the evidence desk'}</h1><p>{setup ? 'Create the first local operator. Setup closes permanently once this account is saved.' : 'Sign in to review current signals, source evidence and analyst decisions.'}</p></section><form className="login-form" noValidate onSubmit={submit}><h2>{setup ? 'First operator' : 'Sign in'}</h2>{expired && !setup && <div className="notice notice-warning" role="status">Your session expired. Sign in to continue.</div>}<FormError message={error} /><TextField ref={userRef} id="username" label="Username" value={username} onChange={event => { setUsername(event.target.value); setError('') }} autoComplete="username" /><div className="password-field"><TextField ref={passwordRef} id="password" label="Password" type={visible ? 'text' : 'password'} value={password} onChange={event => { setPassword(event.target.value); setError('') }} autoComplete={setup ? 'new-password' : 'current-password'} hint={setup ? 'Minimum 12 characters.' : undefined} /><Button type="button" emphasis="ghost" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? 'Hide password' : 'Show password'}</Button></div><Button intent="brand" emphasis="solid" type="submit" busy={busy}>{setup ? 'Create operator' : 'Sign in'}</Button></form></main>
}
