import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// The library build: `src/index.ts` as the package, into `dist/` (`bun run build:lib`). The
// playground's own build is `vite.config.ts`. See "The library build" in `.claude/rules/packaging.md`.

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

// What the package depends on stays an import, for the app to install and share, React above all,
// which must be one copy in the page.
const external = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]
const isExternal = (id: string) => external.some((name) => id === name || id.startsWith(`${name}/`))

// The cascade layer the layered stylesheet puts every rule in.
const LAYER = 'fm'

// The stylesheet a second time, all of it in one layer, as `styles.layer.css`, for an app that orders
// its styles by layers (`@layer reset, fm, app;`). The plain one stays the default, since an app's
// styles outside any layer beat every layered rule, a reset's `* { margin: 0 }` included.
const layeredStylesheet = (): Plugin => ({
  name: 'fm-layered-stylesheet',
  apply: 'build',
  enforce: 'post',
  // After Vite's own, which adds the stylesheet to the bundle as it's generated.
  generateBundle: {
    order: 'post',
    handler(_, bundle) {
      const css = bundle['styles.css']

      if (!css || css.type !== 'asset') {
        this.error(`The library build made no styles.css to put in a layer (${Object.keys(bundle).join(', ')}).`)
      }

      this.emitFile({
        type: 'asset',
        fileName: 'styles.layer.css',
        source: `@layer ${LAYER} {\n${String(css.source)}\n}\n`,
      })
    },
  },
})

export default defineConfig({
  plugins: [react(), layeredStylesheet()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // One stylesheet for the whole package, in the order `styles/order.ts` sets, which the app imports
    // itself; the code doesn't add it to the page.
    cssCodeSplit: false,
    // Left readable: the app's own build minifies it.
    minify: false,
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    rolldownOptions: {
      external: isExternal,
      output: {
        // Every export is a client component, which Next.js's App Router asks to be marked.
        banner: '"use client";',
      },
    },
  },
})
