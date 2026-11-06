import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Nombre del repositorio en GitHub (necesario para GitHub Pages)
  base: '/libreria-admin/',
  plugins: [react()],
})
