import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set `base` so assets resolve correctly when deployed to GitHub Pages
export default defineConfig({
  base: '/coded-research-journal/',
  // Disable React fast-refresh temporarily to avoid preamble timing errors
  // that can occur when the browser blocks the injected refresh client.
  plugins: [react({ fastRefresh: false })]
})
