import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// バス運賃くらべ（バスアプリ）。
// index.html と busfare.html の両方を同じバスアプリとして配信する。
// 入力はプロジェクトルートからの相対パスで指定する。
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        busfare: 'busfare.html',
      },
    },
  },
})
