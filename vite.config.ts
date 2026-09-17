import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/overpass': {
        target: 'https://overpass.private.coffee',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/overpass/,
            '',
          ),
        headers: {
          'User-Agent':
            'MotoRoute/0.4 ferry-catalog-test',
        },
      },
    },
  },
})
