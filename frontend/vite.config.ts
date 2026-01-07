// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 1. 플러그인 가져오기

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 2. 플러그인 추가
  ],
})