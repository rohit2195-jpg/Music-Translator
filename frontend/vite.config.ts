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
        target: "https://music-translator.onrender.com",
        changeOrigin: true,
      },
      "/lyrics": {
        target: "https://music-translator.onrender.com",
        changeOrigin: true,
      }
    },
     
  },
})
