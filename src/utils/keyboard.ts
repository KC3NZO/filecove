import type { KeyboardEvent } from "react";

import type { EntryLayout } from "../types";

/** The keys that open a context menu: the Menu key, or Shift+F10. */
export const isMenuKey = (event: KeyboardEvent) =>
    event.key === "ContextMenu" ||
    (event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey);

/** A key that types a character, which type-ahead finds an entry by. Shift is allowed, for capitals. */
export const isTypingKey = (event: KeyboardEvent) =>
    [...event.key].length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;

/** Whether an element's text runs right to left, which swaps what Left and Right mean. */
export const isRtl = (element: Element) => getComputedStyle(element).direction === "rtl";

/** How many rows of `item`'s height PageUp and PageDown move by in `scroller`, keeping one in view. */
export const pageRows = (scroller: HTMLElement, item: HTMLElement) =>
    Math.max(1, Math.floor(scroller.clientHeight / Math.max(item.offsetHeight, 1)) - 1);

/**
 * Where `key` moves the focus to from `index` among `count` entries laid out as `layout`, or null
 * when it isn't a key that moves it there. Down from the row above a shorter last row lands on the
 * last entry, as in desktop file managers.
 */
export const stepIndex = (
    key: string,
    index: number,
    count: number,
    { columns, horizontal, page, rtl }: EntryLayout,
): number | null => {
    const last = count - 1;

    switch (key) {
        case "ArrowDown":
            if (index + columns <= last) {
                return index + columns;
            }

            return Math.floor(index / columns) < Math.floor(last / columns) ? last : index;
        case "ArrowUp":
            return index - columns >= 0 ? index - columns : index;
        case "ArrowLeft":
        case "ArrowRight": {
            if (!horizontal) {
                return null;
            }

            const step = (key === "ArrowRight") !== rtl ? 1 : -1;

            return Math.min(Math.max(index + step, 0), last);
        }
        case "Home":
            return 0;
        case "End":
            return last;
        case "PageDown":
            return Math.min(index + page * columns, last);
        case "PageUp":
            return Math.max(index - page * columns, 0);
        default:
            return null;
    }
};

/**
 * The index of the next of `names` that starts with `query`, looking from `from` and wrapping
 * around, or -1. One letter typed again and again steps through the names starting with it, so
 * it looks from the name after `from`; a longer query stays on `from` while it still fits.
 * Letters are compared by `sameLetters`, which leaves case and accents aside (`Locale.sameLetters`).
 */
export const matchName = (
    names: string[],
    from: number,
    query: string,
    sameLetters: (a: string, b: string) => boolean,
) => {
    const chars = [...query];
    const repeated = chars.every((char) => sameLetters(char, chars[0]));
    const prefix = repeated ? chars[0] : query;
    const start = Math.max(repeated ? from + 1 : from, 0);

    for (let offset = 0; offset < names.length; offset += 1) {
        const index = (start + offset) % names.length;

        if (sameLetters(names[index].slice(0, prefix.length), prefix)) {
            return index;
        }
    }

    return -1;
};

/** Focuses a tree item and scrolls it into view. */
export const focusTreeItem = (item: HTMLElement) => {
    item.focus({ preventScroll: true });
    item.scrollIntoView({ block: "nearest" });
};
