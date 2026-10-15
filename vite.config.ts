import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'MrBiller.online - Shop Billing',
          short_name: 'MrBiller.online',
          description: 'Billing software for Indian shops with GST, bilingual support',
          theme_color: '#1a1a1a',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          lang: 'en',
          dir: 'ltr',
          categories: ['business', 'productivity', 'finance'],
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'charts': ['recharts'],
            'pdf': ['jspdf', 'jspdf-autotable'],
            'i18n': ['i18next', 'react-i18next'],
            'db': ['dexie', 'dexie-react-hooks'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
})
