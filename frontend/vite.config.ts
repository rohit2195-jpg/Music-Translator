import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/auth": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/lyrics": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      }
    },
     
  },
})
