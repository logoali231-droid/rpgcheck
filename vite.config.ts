import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

// The cloud preview hostname is injected per VM. Only that explicit host is
// allowed; localhost and network IPs keep Vite's defaults.
const previewHosts = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: previewHosts.length ? previewHosts : undefined,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: previewHosts.length ? previewHosts : undefined,
  },
})
