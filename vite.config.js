import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set `base` so assets resolve correctly when deployed to GitHub Pages
export default defineConfig({
  base: '/coded-research-journal/',
  plugins: [react()]
})
