import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'

export interface ApiState<T> { data: T | null; loading: boolean; error: string; reload: () => void }

export function useApi<T>(path: string): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const sequence = useRef(0)
  const reload = useCallback(() => setVersion(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    const request = ++sequence.current
    setLoading(true); setError('')
    apiRequest<T>(path, { signal: controller.signal })
      .then(value => { if (sequence.current === request) setData(value) })
      .catch(reason => { if (!(reason instanceof DOMException && reason.name === 'AbortError') && sequence.current === request) setError(reason instanceof Error ? reason.message : 'Request failed') })
      .finally(() => { if (sequence.current === request) setLoading(false) })
    return () => controller.abort()
  }, [path, version])
  return { data, loading, error, reload }
}
