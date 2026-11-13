import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from /<repository-name>/.
  // The deployment workflow sets VITE_BASE_PATH; local builds use /.
  base: process.env.VITE_BASE_PATH || '/',
  // Allow mobile devices on the same local network to access the dev server.
  server: {
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss()],
})
