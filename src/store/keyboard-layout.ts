// A Latin letter or digit, as a shortcut names one.
const LATIN = /^[a-z0-9]$/;

/** What Chromium's `navigator.keyboard` gives, which the DOM's types don't have yet. */
interface KeyboardLayoutApi {
    getLayoutMap(): Promise<ReadonlyMap<string, string>>;
}

// The Latin letter or digit printed on each key, by its `code`, as last seen typed on this keyboard.
const printed = new Map<string, string>();

// How many file managers watch the keyboard, so the listeners go with the last.
let watchers = 0;

const learn = (code: string, key: string) => {
    const typed = key.toLowerCase();

    if (code && LATIN.test(typed)) {
        printed.set(code, typed);
    }
};

// A key typed with no modifier but Shift types what's printed on it on the layout in use.
const onKeyDown = (event: KeyboardEvent) => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.getModifierState("AltGraph")) {
        learn(event.code, event.key);
    }
};

// Chromium tells what the layout in use types on each key, unshifted, before anything is typed. A
// non-Latin layout's letters are skipped, keeping what a Latin one taught.
const readLayout = () => {
    const keyboard = (navigator as Navigator & { keyboard?: KeyboardLayoutApi }).keyboard;

    keyboard
        ?.getLayoutMap()
        .then((layout) => layout.forEach((key, code) => learn(code, key)))
        // Refused in a frame the page doesn't allow it to (the `keyboard-map` policy).
        .catch(() => undefined);
};

/**
 * The Latin letter or digit printed on the key at `code`, as this keyboard's own Latin layout types
 * it, or undefined when it hasn't been seen. It's learned from the layout map where the browser has
 * one (Chromium), and from every key typed in the page without Ctrl, Alt or ⌘, so a keyboard whose
 * Latin letters aren't laid out as on a US one is known once a Latin layout has been used on it:
 * the Russian layout's "ф" on a French keyboard is then its "q", not the US "a", and Option+A on a
 * French Mac is "a", though it types "æ".
 */
export const printedAt = (code: string) => printed.get(code);

/** Learns the keyboard's letters while a file manager is mounted, for `printedAt`. Returns the cleanup. */
export const watchKeyboardLayout = () => {
    if (watchers++ === 0) {
        window.addEventListener("keydown", onKeyDown, true);
        // The layout may have been switched while the page was away.
        window.addEventListener("focus", readLayout);
        readLayout();
    }

    return () => {
        if (--watchers === 0) {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("focus", readLayout);
        }
    };
};
