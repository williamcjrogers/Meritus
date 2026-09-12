/** The same reviewed interface runs locally and behind the director gateway. */
export function applicationBase(): string {
  return (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
}

export function applicationPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('An application path is required')
  return `${applicationBase()}${path}`
}

export function isEmbedded(): boolean {
  return import.meta.env.VITE_MERITUS_EMBEDDED === 'true'
}
