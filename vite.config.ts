import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: 'backend',
  server: { port: 5173, host: '0.0.0.0' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
