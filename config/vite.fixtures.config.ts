import { resolve } from 'node:path'
import { mergeConfig } from 'vite'
import webConfig from '../vite.web.config'

// Dev-only component fixture explorer; never part of a production build input.
export default mergeConfig(webConfig, {
  tsconfig: resolve('config/tsconfig.web.json'),
  cacheDir: resolve('.cache/vite/fixtures'),
  base: '/',
  plugins: [
    {
      name: 'fixture-windows-oniguruma-url',
      enforce: 'pre',
      apply: 'serve',
      resolveId(id) {
        if (process.platform === 'win32' && id === 'vscode-oniguruma/release/onig.wasm?url') {
          return '\0fixture-oniguruma-url'
        }
      },
      load(id) {
        if (id !== '\0fixture-oniguruma-url') {
          return
        }
        // The raw-FS server skips hidden global pnpm-store paths; the workspace link serves the same bytes.
        const asset = `/@fs/${resolve('node_modules/vscode-oniguruma/release/onig.wasm').replaceAll('\\', '/')}`
        return `export default ${JSON.stringify(asset)}`
      }
    }
  ],
  server: {
    host: '127.0.0.1',
    warmup: {
      clientFiles: ['./src/component-fixtures/component-fixture-explorer.tsx']
    }
  },
  // Pre-crawl fixtures to prevent lazy dependency re-optimization from loading two React copies.
  optimizeDeps: {
    entries: ['fixtures.html', 'src/**/*.fixture.tsx']
  },
  build: {
    outDir: resolve('.cache/fixtures/build'),
    rollupOptions: {
      input: resolve('src/renderer/fixtures.html')
    }
  }
})
