---
paths:
  - "src/**/*.{ts,tsx}"
---

# TypeScript Typing

- For components or contexts that need an `interface` or `type` for their `props`, `state` or anything like that, write those types in the same file.

- Types that are shared, or are going to be exported and used in many places, go in an organized way inside `src/types/` (one file per domain, re-exported from `src/types/index.ts`). Don't just write them directly in components or anywhere else.
