import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pluginRequire = createRequire(require.resolve('@vitejs/plugin-react'));
const { createServer } = await import(pluginRequire.resolve('vite'));
const { default: react } = await import('@vitejs/plugin-react');
const preview = fileURLToPath(new URL('.', import.meta.url));
const repository = path.resolve(preview, '../../../..');

const server = await createServer({
  configFile: false,
  root: preview,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/lib/actions/server', replacement: path.join(preview, 'action-mocks.js') },
      { find: '@/lib/portal/actions', replacement: path.join(preview, 'portal-action-mocks.js') },
      { find: '@/lib/portal/client-actions', replacement: path.join(preview, 'client-action-mocks.js') },
      { find: '@clerk/nextjs/legacy', replacement: path.join(preview, 'clerk-mock.jsx') },
      { find: '@clerk/nextjs', replacement: path.join(preview, 'clerk-mock.jsx') },
      { find: 'next/navigation', replacement: path.join(preview, 'navigation-mocks.js') },
      { find: 'next/link', replacement: path.join(preview, 'link-mock.jsx') },
      { find: '@', replacement: path.join(repository, 'src') },
    ],
  },
  css: { postcss: repository },
  server: { host: '127.0.0.1', port: 4319, strictPort: true, fs: { allow: [repository] } },
});
await server.listen();
server.printUrls();
