import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(fileURLToPath(import.meta.url))
const legacy = new Set(['en', 'ja', 'posts', 'places', 'map', 'ranking', 'contact', 'profile', 'publish', 'messages', 'gifts', 'search', 'admin', 'auth'])
// Two independent documents keep both apps' CSS isolated. / 两个入口隔离样式。
function sharedSite() {
  function routes(server) {
    server.middlewares.use((req, res, next) => {
      const url = new URL(req.url, 'http://localhost')
      if (legacy.has(url.pathname.split('/')[1])) {
        res.writeHead(308, { Location: `/shanyao${url.pathname}${url.search}` })
        res.end()
        return
      }
      if (url.pathname === '/shanyao') {
        res.writeHead(308, { Location: `/shanyao/${url.search}` })
        res.end()
        return
      }
      if (url.pathname.startsWith('/shanyao/') && !url.pathname.endsWith('.html')) {
        req.url = `/shanyao/index.html${url.search}`
      }
      next()
    })
  }
  return {
    name: 'study-and-shanyao',
    configureServer: routes,
    configurePreviewServer: routes,
    closeBundle() { cpSync(resolve(root, 'study-room/public'), resolve(root, 'dist'), { recursive: true }) },
  }
}
const proxy = Object.fromEntries(['/api', '/media', '/health', '/study-assets'].map(path => [path, {
  target: process.env.SHANYAO_DEV_BACKEND || 'http://127.0.0.1:8000', changeOrigin: false,
}]))
export default defineConfig({
  plugins: [react(), sharedSite()],
  server: { proxy },
  preview: { proxy },
  build: { rollupOptions: { input: { study: resolve(root, 'index.html'), shanyao: resolve(root, 'shanyao/index.html') } } },
})
