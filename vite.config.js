import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  base: '/nui-photocollage/',
  build: {
    outDir: 'dist',
  },
  // Copy WASM files to public directory
  publicDir: 'public',
})
