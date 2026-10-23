/**
 * What's typed in a search, as the words a name has to hold, each folded by `fold` (case and
 * accents left out, `Locale.foldLetters`). None when nothing but spaces is typed.
 */
export const searchTerms = (query: string, fold: (text: string) => string) =>
    fold(query).split(/\s+/u).filter(Boolean);

/** Whether a name, folded as the terms are, holds every one of them, anywhere in it and in any order. */
export const holdsTerms = (name: string, terms: readonly string[]) => terms.every((term) => name.includes(term));
