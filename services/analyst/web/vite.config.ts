import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_MERITUS_BASE_PATH || '/'
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid application base path')
  return {
    base,
    plugins: [react()],
    server: { proxy: base === '/' ? { '/api': 'http://127.0.0.1:8000' } : {} },
    // Embedded assets also start with /api, so static preview must not proxy them.
    preview: { proxy: {} },
  }
})
