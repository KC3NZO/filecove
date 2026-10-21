import type { KeyboardEvent } from "react";

/**
 * Whether a key press matches a shortcut written as menus show it, e.g. "Shift+Ctrl+N", "F2" or
 * "Delete". Ctrl also matches ⌘, so the same shortcut works on macOS.
 */
export const matchesShortcut = (event: KeyboardEvent, shortcut: string) => {
    const parts = shortcut.toLowerCase().split("+");
    const key = parts.pop();

    return (
        event.key.toLowerCase() === key &&
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
