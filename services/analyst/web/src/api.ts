import type { Session } from './types'
import { applicationPath } from './runtime'

let csrfToken = ''
export function setCsrf(token: string) { csrfToken = token }
export const SYNTHETIC_RESPONSE_EVENT = 'meritus:synthetic-response'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError' }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const method = (options.method ?? 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken)
  let response: Response
  try {
    const url = new URL(applicationPath(path), window.location.origin)
    const requestOptions: RequestInit = { ...options, headers, credentials: 'same-origin' }
    if (requestOptions.signal && navigator.userAgent.includes('jsdom')) {
      delete requestOptions.signal
    } else if (requestOptions.signal) {
      const signalClass = new Request(url).signal.constructor
      if (!(requestOptions.signal instanceof signalClass)) delete requestOptions.signal
    }
    response = await fetch(url, requestOptions)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Meritus could not reach the analyst service. Try again shortly.')
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try { detail = String((await response.json() as { detail?: unknown }).detail ?? detail) } catch { /* response had no JSON detail */ }
    if (response.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new CustomEvent('meritus:unauthorised'))
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  const data = await response.json() as T
  if (data && typeof data === 'object' && 'synthetic' in data && data.synthetic === true) window.dispatchEvent(new CustomEvent(SYNTHETIC_RESPONSE_EVENT))
  return data
}

export async function authenticate(mode: 'login' | 'setup', username: string, password: string): Promise<Session> {
  const session = await apiRequest<Session>(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ username, password }) })
  setCsrf(session.csrf_token)
  return session
}
