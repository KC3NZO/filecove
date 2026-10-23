import type { FileManagerSearch } from "../types";

/**
 * What's typed in a search, as the words a name has to hold, each folded by `fold` (case and
 * accents left out, `Locale.foldLetters`). None when nothing but spaces is typed.
 */
export const searchTerms = (query: string, fold: (text: string) => string) =>
    fold(query).split(/\s+/u).filter(Boolean);

/** Whether a name, folded as the terms are, holds every one of them, anywhere in it and in any order. */
export const holdsTerms = (name: string, terms: readonly string[]) => terms.every((term) => name.includes(term));

/**
 * The key of a search everywhere's result: its section and its id, since entries of different
 * adapters may share ids, and one entry may be found in two sections sharing an adapter. Joined by
 * a control character no id is likely to hold, which `CSS.escape` keeps findable in the page, as
 * it wouldn't a NUL.
 */
export const resultKey = (sectionId: string, entryId: string) => `${sectionId}\u001f${entryId}`;

/** Whether two searches are the same, or both closed (null). */
export const sameSearch = (a: FileManagerSearch | null, b: FileManagerSearch | null) =>
    a === b || (!!a && !!b && a.scope === b.scope && a.query === b.query);
