/** Whether two sets of ids hold the same ids, in whatever order. */
export const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
    a === b || (a.size === b.size && [...a].every((id) => b.has(id)));
