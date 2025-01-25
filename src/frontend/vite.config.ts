import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, '../backend/bin/Release/net8.0/publish/wwwroot/_framework/'),
          dest: './',
        },
      ],
    })
  ],
  base: "./",
})
