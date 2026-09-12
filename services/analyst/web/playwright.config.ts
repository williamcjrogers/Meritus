import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: '../.superpowers/sdd/2026-09-12-analyst-desk/verification/playwright',
  reporter: [['list'], ['html', { outputFolder: '../.superpowers/sdd/2026-09-12-analyst-desk/verification/playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'corepack pnpm dev --host 127.0.0.1 --port 4173', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'narrow-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
})
