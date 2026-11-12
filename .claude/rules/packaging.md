---
paths:
  - "package.json"
  - "vite.lib.config.ts"
  - "vite.config.ts"
  - "tsconfig.lib.json"
  - "scripts/**"
  - "src/index.ts"
  - "src/styles/order.ts"
---

# Packaging

`src/` is published as a package, built by `bun run build:lib` into `dist/`. The playground's own build (`bun run build`, `vite.config.ts`) goes into `dist-playground/`, so the two never overwrite each other. Built 2026-11-12, as the user wanted to use the package in a project of theirs; what's still open before a release is in the roadmap's "Packaging".

## The library build

`build:lib` runs three steps:

1. **`vite build -c vite.lib.config.ts`**, Vite's library mode on `src/index.ts`: the entry, `dist/index.js` (with its source map), unminified, since the app's build minifies it, and one stylesheet, `dist/styles.css` (`cssCodeSplit: false`, `cssFileName: "styles"`).
   - **The icons' styles are entries too** (`ICON_STYLES`): `src/icon-sets/<style>.ts` built as `dist/icon-sets/<style>.js`, beside the declarations `tsc` writes there, sharing `createIcon` through a chunk of its own (`create-icon-….js`). The entry imports Outlined's file, its default, and none of the others, so an app ships only the styles it imports (see "The Material icons' styles" in `icons.md`).
   - **`@react-symbols/icons` stays a dynamic `import()`** in `index.js`, which an app's bundler makes a chunk of its own, loaded after the component mounts (see "The coloured file and folder icons" in `icons.md`). Nothing may import it statically, or every app downloads it with the rest.
   - **What stays an import**: every dependency and peer dependency in `package.json`, and their subpaths (`react/jsx-runtime`, `@base-ui/react/menu`), read from `package.json` so a dependency added there is never bundled. React must be one copy in the page, so it's a peer dependency (`^19.0.0`; the code needs 19, as `<Context value>` does), kept in `devDependencies` for the playground.
   - **`"use client";`** heads `index.js` (the output's `banner`), as every export is a client component, which Next.js's App Router asks to be marked.
   - **Dev-only checks** read `process.env.NODE_ENV`, never `import.meta.env.DEV`, which library mode replaces as it builds, so the warnings would be gone for good; `process.env.NODE_ENV` is left for the app's bundler (`use-controlled.ts`).
2. **`tsc -p tsconfig.lib.json`** writes the declarations, a `.d.ts` beside each module under `dist/` (`index.d.ts` the entry), from `tsconfig.app.json` with `src` only. Every type an exported one reaches must be exported from its module, or `tsc` can't name it (TS4023, as `DataContextValue` was).
3. **`bun scripts/clean-declarations.ts`** takes the side-effect imports (`import "./styles/order";` and the stylesheets `order.ts` imports) out of the declarations: they'd point at CSS the package doesn't ship, which an app's TypeScript checking such imports (`noUncheckedSideEffectImports`) refuses.

## The stylesheets

The code doesn't put its CSS in the page: an app imports one of two files itself, once, as Mantine's are.

- **`styles.css`**, the default: no cascade layer, so an app's resets and element rules (`* { margin: 0 }`, `button { … }`) can't break the component, its class rules being stronger; an app's own rule for a part wins by loading after it, or with one more class or attribute (see "Stable class names" in `component-styling.md`).
- **`styles.layer.css`**: the same, inside `@layer fm` (`LAYER` in `vite.lib.config.ts`), made by the build's `fm-layered-stylesheet` plugin wrapping the built stylesheet, after Vite's own adds it to the bundle (`enforce` and `order` "post"). For an app that orders its styles by layers: `@layer reset, fm, app;`, then any rule of the app's wins. The user chose both files on 2026-11-12. The layer keeps the name `fm`, as the `fm-` class names do, whatever the package is called (`filecove`, chosen 2026-11-12).
- **The order** inside both is the one `styles/order.ts` sets, as `src/index.ts` imports it first: the theme, the kit, the shared stylesheets, then each part's (see "CSS Modules" in `ui-kit.md`).
- **Only at-rules that work inside a layer**: the stylesheets use `@container`, `@media` and `@keyframes`. One adding `@import`, `@font-face`, `@property` or `@charset` has to be checked against the layered copy, as some can't go inside `@layer { }`.
- Class names are Vite's hashed ones (`_row_1cep9_12`), unique to the file; the stable `fm-…` names are beside them.

## package.json

- `exports`: `"."` (`types` first, then `import`), `"./icons/filled"`, `"./icons/outlined"`, `"./icons/rounded"`, `"./icons/sharp"` and `"./icons/two-tone"` (each `dist/icon-sets/<style>`, `types` first), `"./styles.css"`, `"./styles.layer.css"` and `"./package.json"`. Listed one by one rather than as `"./icons/*"`, so no other path under `dist/icon-sets/` is reachable. ESM only, with `module` and `types` for older tools.
- `sideEffects: ["**/*.css"]`, so a bundler keeps the stylesheet an app imports and shakes the rest.
- `files`: `dist`, `docs` (the consumer docs, so an app's `node_modules/filecove/docs/` matches the version it installed; see "The consumer docs") and `THIRD_PARTY_NOTICES.md` (the Material Icons' license; see `icons.md`). `package.json`, the README and `LICENSE` (MIT) go anyway.
- Named `filecove` (the user's pick, 2026-11-12), so an app imports `filecove`, `filecove/icons/<style>` and `filecove/styles.css`. `private` came off for 0.1.0 (2026-11-12), with a `description`, `keywords`, `CHANGELOG.md` in `files`, and `prepublishOnly` running `build:lib`, so a stale `dist/` never goes out. `repository`, `homepage` and `bugs` wait for the repo's new name.
- **Publishing** is `bun publish` (npm is broken on the user's machine), signed in by a granular token in `~/.npmrc` and the account's two-factor code; `bun publish --dry-run` lists what goes. Later releases are planned from CI with npm's trusted publishing.

## The consumer docs

`docs/` at the root is the documentation for apps using the package, written 2026-11-12: plain Markdown with relative links, so it reads on GitHub, in `node_modules` and as a site's source later, and guides with examples rather than a prop reference, which the `.d.ts` comments are. `docs/README.md` is its index, with a section for AI coding assistants. The README at the root is short and links into it.

- **Not the rules.** `.claude/rules/` are notes for working on the component; `docs/` is for using it, in plain English, with nothing internal (no hook, store or file names but the public ones).
- **Kept current.** A change to public behaviour updates the page in `docs/` that covers it, as well as its rule (see the checklist in `props.md`). Out-of-date docs mislead an agent more than none.
- Code in it is checked against the public types by eye, not compiled.

## Server rendering

An app rendering on a server (Next.js, Remix, Astro) renders each root once there, `"use client"` or not, and hydrates it in the browser. So every `useSyncExternalStore` passes its server snapshot, the same function as the client's: each store is made per root and starts empty on both sides, so they agree. Nothing reads `window`, `document` or `navigator` while rendering, only in effects and handlers. A new hook on a store does the same.

## Trying it out

What an app gets is the packed package, so that's what's tried, in a scratch app outside the repo:

1. `bun run build:lib`, then `bun pm pack --destination <folder>`, which packs what `files` names, as publishing would.
2. In a scratch app, `bun add <folder>/filecove-0.0.0.tgz react react-dom`, and check that the package has no `node_modules` of its own (one React).
3. Type-check an app importing `FileManager`, a type and both stylesheets with `strict`, `skipLibCheck: false` and `noUncheckedSideEffectImports`, and build it with Vite.
4. Render `FileManager`, `MediaManager` and `MediaPicker` with `renderToString` under Bun, in development and production, for server rendering.

Done 2026-11-12, all passing, and again for 0.1.0 the same day with slots, `slotProps`, `headerActions` and the icon styles in the app. An app linking the repo instead (`bun link`, a `file:` path) resolves `react` from the repo's own `node_modules`, two copies of React in the page; the packed file doesn't, which is why it's the way to try it, and what the user is told to install.

## Not yet

- The declarations are one file per module, imported without extensions, which an app's TypeScript resolves with `moduleResolution` `bundler` (Vite's and Next.js's own) but not `node16` or `nodenext`; bundling them into one `index.d.ts` would cover both.
- The rest of the roadmap's packaging: `index.html`'s title, the repo's name with `repository` and `homepage`, and development warnings.
