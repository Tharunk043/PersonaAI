import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { 
        target: "https://persona-ai-backend-d69i.onrender.com", 
        changeOrigin: true, 
        secure: false 
      },
      "/api2": { 
        target: "https://persona-ai-backend-d69i.onrender.com", 
        changeOrigin: true, 
        secure: false 
      }
    }
  }
})
