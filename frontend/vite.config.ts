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
        target: "https://7sjjoysyp7azjgbsrmliwjkhnq0yuiue.lambda-url.us-east-2.on.aws/",
        changeOrigin: true,
      },
      "/lyrics": {
        target: "https://7sjjoysyp7azjgbsrmliwjkhnq0yuiue.lambda-url.us-east-2.on.aws/",
        changeOrigin: true,
      }
    },
     
  },
})
