import { useCallback, useState } from "react";

// The playground keeps the file manager's view settings across reloads, in local storage, as a
// consumer controlling them might. A private window may refuse storage, and then they last a visit.

const PREFIX = "file-manager-playground:";

const read = <T>(key: string, fallback: () => T): T => {
    try {
        const stored = localStorage.getItem(PREFIX + key);

        return stored === null ? fallback() : (JSON.parse(stored) as T);
    } catch {
        return fallback();
    }
};

/**
 * A value kept in local storage under `key`: `initial`, or what it makes, until something is stored
 * there. The value is never a function, so a function is what makes it.
 */
export const useStoredState = <T>(key: string, initial: T | (() => T)) => {
    const [value, setValue] = useState(() =>
        read(key, () => (typeof initial === "function" ? (initial as () => T)() : initial)),
    );

    const store = useCallback(
        (next: T) => {
            setValue(next);

            try {
                localStorage.setItem(PREFIX + key, JSON.stringify(next));
            } catch {
                // Kept for this visit only.
            }
        },
        [key],
    );

    return [value, store] as const;
};
