import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Docker container port mapping
    port: 5175,
    watch: {
      usePolling: true, // File watching in Docker
    },
  },
  preview: {
    host: true,
    port: 3005,
  }
})