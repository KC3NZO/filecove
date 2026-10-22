/**
 * Isolates text from outside a sentence or line the component writes, between Unicode's first
 * strong isolate and pop directional isolate, so it runs in its own direction whatever the text
 * around it does: a name, an adapter's or a server's message, or a value formatted in the `locale`,
 * whose script needn't be the page's. A Latin name in an Arabic sentence, or ".bashrc" in either,
 * then keeps its punctuation where it was typed. Names shown on their own are isolated in markup
 * instead, with `<bdi>`.
 */
export const isolate = (text: string) => `\u2068${text}\u2069`;

/**
 * Joins pieces with a separator the component writes itself, " · " between details unless another
 * is given, each piece isolated, so they're laid out the way the page runs whatever script each is
 * in: a size and a date formatted in Latin digits still read from the right on a right-to-left page.
 */
export const joinIsolated = (parts: readonly string[], separator = " · ") => parts.map(isolate).join(separator);
