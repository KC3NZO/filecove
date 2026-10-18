---
paths: 
	- "src/**/*.{ts,tsx}"
---

# Typescript Typing

- For components or context's, that want `interface` or `type` for their `props` or `states` or anything like that, write those types there.

- For type that is shared or is going to be exported and used many placed, put them in an organized way inside @src/types and don't just write them directly in components or anythere you want