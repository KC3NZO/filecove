import type { KeyboardEvent } from "react";

const LATIN = /^[a-z0-9]$/;

// The letter or digit at a key's place, as `code` names it after the US layout: "KeyH", "Digit1".
const PLACE = /^(?:Key([A-Z])|Digit([0-9]))$/;

/**
 * The keys a press stands for in a shortcut, lowercased as menus name them ("h", "1", "+",
 * "delete", "space"), the likeliest first.
 *
 * The key the layout types comes first, so a shortcut follows the letters printed on the keyboard:
 * Ctrl+Z is the key marked Z on QWERTY, AZERTY, QWERTZ and Dvorak alike, wherever it sits. When
 * that isn't a Latin letter or digit, as on a Russian, Arabic, Hebrew or Greek layout, or what
 * Shift, AltGr or Option make of a key ("!", "&", "é", "˙"), the Latin letter or digit at the key's
 * place follows, since those keyboards print it beside their own letter. Named keys (F2, Delete,
 * the arrows) are the same on every layout.
 */
export const pressedKeys = (event: Pick<KeyboardEvent, "key" | "code">) => {
    // Menus name the space bar, which the event gives as the character it types.
    const typed = event.key === " " ? "space" : event.key.toLowerCase();
    const place = PLACE.exec(event.code);

    return place && !LATIN.test(typed) ? [typed, (place[1] ?? place[2]).toLowerCase()] : [typed];
};

/** Whether a press stands for `key` ("h", "1", "+") on the layout it was typed on. */
export const pressesKey = (event: Pick<KeyboardEvent, "key" | "code">, key: string) =>
    pressedKeys(event).includes(key);

/**
 * Whether a key press, taken as `key` (one of its `pressedKeys`), matches a shortcut written as
 * menus show it, e.g. "Shift+Ctrl+N", "F2", "Delete" or "Space". Ctrl also matches ⌘, so the same
 * shortcut works on macOS.
 */
export const matchesShortcut = (event: KeyboardEvent, shortcut: string, key: string) => {
    const parts = shortcut.toLowerCase().split("+");

    return (
        parts.pop() === key &&
        (event.ctrlKey || event.metaKey) === parts.includes("ctrl") &&
        event.shiftKey === parts.includes("shift") &&
        event.altKey === parts.includes("alt")
    );
};

/**
 * A shortcut as `aria-keyshortcuts` names it, e.g. "Shift+Control+N Shift+Meta+N" for
 * "Shift+Ctrl+N", since Ctrl also matches ⌘.
 */
export const ariaShortcut = (shortcut: string) => {
    const parts = shortcut.split("+");
    const ctrl = parts.findIndex((part) => part.toLowerCase() === "ctrl");

    if (ctrl < 0) {
        return shortcut;
    }

    const withKey = (key: string) => parts.map((part, index) => (index === ctrl ? key : part)).join("+");

    return `${withKey("Control")} ${withKey("Meta")}`;
};
