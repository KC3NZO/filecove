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
