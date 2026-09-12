import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE || '/pv/',
  server: {
    port: 5173,
    proxy: {
      '/pv/api': 'http://127.0.0.1:8000',
    },
  },
})
