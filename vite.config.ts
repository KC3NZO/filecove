import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// The playground. The package itself is built by `vite.lib.config.ts` into `dist/`, so the playground
// builds beside it.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-playground',
  },
})
