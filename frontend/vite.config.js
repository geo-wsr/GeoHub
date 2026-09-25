import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

/**
 * GitHub Pages 只能托管静态文件、没有服务端重写规则。
 * 构建后把 index.html 复制一份成 404.html：
 * 直接访问子路由或刷新页面时，Pages 会返回 404.html，SPA 便能接管路由。
 */
function spaFallback() {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist/', import.meta.url))
      copyFileSync(`${dist}index.html`, `${dist}404.html`)
    },
  }
}

// 资源基础路径（base）：
//   1. 交给 Django 托管（默认）：/static/
//   2. GitHub Pages 仓库子路径：CI 注入 VITE_BASE_PATH=/<仓库名>/
//   3. GitHub Pages 自定义域名：CI 注入 VITE_BASE_PATH=/
// 它会同时决定 index.html 里的资源前缀与 Vue Router 的 history base。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE_PATH || '/static/' : '/',
  plugins: [vue(), spaFallback()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // 开发期前端默认留空 VITE_API_BASE_URL，走下面的代理调用本地后端
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/accounts': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
}))