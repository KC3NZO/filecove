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

/**
 * How well a name answers the words typed, higher being better, both folded alike: a name that is
 * the words, with or without its extension, is first; one that starts with them next; then each
 * word counts for more where it starts a word of the name than inside one. Of names scoring alike,
 * the shorter is nearer to what's typed.
 */
export const relevanceOf = (name: string, terms: readonly string[]) => {
    const phrase = terms.join(" ");
    const dot = name.lastIndexOf(".");
    let score = 0;

    if (name === phrase || (dot > 0 && name.slice(0, dot) === phrase)) {
        score += 100;
    } else if (name.startsWith(phrase)) {
        score += 50;
    }

    for (const term of terms) {
        score += startsWord(name, term) ? 2 : 1;
    }

    return score - name.length / 1000;
};

/** Whether `term` is in the name where a word of it begins: at its start, or after something that isn't a letter or digit. */
const startsWord = (name: string, term: string) => {
    for (let at = name.indexOf(term); at >= 0; at = name.indexOf(term, at + 1)) {
        if (!/[\p{L}\p{N}]$/u.test(name.slice(0, at))) {
            return true;
        }
    }

    return false;
};
