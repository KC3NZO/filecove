import type { KeyboardEvent } from "react";

import type { FileManagerLocaleText } from "../types";

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
 * Ctrl+?, which shows the keyboard shortcuts, as in GNOME: "?" wherever the layout has it, Shift
 * or not, or the Arabic and Persian "؟" on theirs. Ctrl only, not ⌘, since ⌘? opens the browser's
 * Help menu on macOS before the page sees it.
 */
export const showsShortcuts = (event: KeyboardEvent) =>
    event.ctrlKey && !event.metaKey && !event.altKey && (pressesKey(event, "?") || pressesKey(event, "؟"));

/**
 * Whether a key press comes from a field the user types in, where a shortcut without Ctrl or Alt,
 * a letter, Space or Delete, edits what's typed. F-keys type nothing, so they still count.
 */
export const typesInField = (event: KeyboardEvent) =>
    event.target instanceof HTMLElement &&
    (event.target.isContentEditable || event.target.matches("input, textarea, select")) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !/^F\d+$/.test(event.key);

/** A shortcut written as menus show it, as the keys pressed together: "Shift+Ctrl+N" as Shift, Ctrl and N. */
export const shortcutKeys = (shortcut: string): readonly string[] => shortcut.split("+");

/**
 * The same text for every way of writing the same keys, however they're cased or ordered, to tell
 * whether two shortcuts are one.
 */
export const comboId = (keys: readonly string[]) => {
    const lower = keys.map((key) => key.toLowerCase());

    return [...lower.slice(0, -1).sort(), lower.at(-1)].join("+");
};

const ARROWS: Record<string, string> = {
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
};

/**
 * A key as the keyboards of the file manager's language name it: "Ctrl" as `keyCtrl` ("Strg" in
 * German), the arrows as arrows, and letters uppercased. A key the text has no name for, such as
 * F2 or ",", is shown as written.
 */
export const keyLabel = (key: string, text: FileManagerLocaleText) => {
    const lower = key.toLowerCase();
    const named: Record<string, string> = {
        ctrl: text.keyCtrl,
        control: text.keyCtrl,
        shift: text.keyShift,
        alt: text.keyAlt,
        enter: text.keyEnter,
        escape: text.keyEscape,
        esc: text.keyEscape,
        space: text.keySpace,
        backspace: text.keyBackspace,
        delete: text.keyDelete,
        tab: text.keyTab,
        home: text.keyHome,
        end: text.keyEnd,
        pageup: text.keyPageUp,
        pagedown: text.keyPageDown,
        contextmenu: text.keyMenu,
        ...ARROWS,
    };

    return named[lower] ?? ([...key].length === 1 ? key.toUpperCase() : key);
};

/** Keys pressed together as one line, "Ctrl+?" or "Strg+?", for a menu. */
export const formatShortcut = (keys: readonly string[], text: FileManagerLocaleText) =>
    keys.map((key) => keyLabel(key, text)).join("+");

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
