import type { FileAdapter, FileEntry } from "../adapter";

export interface FolderState {
    status: "loading" | "ready" | "error";
    /** The latest listing. Kept while a refresh is loading so the view doesn't blank out. */
    entries?: FileEntry[];
    error?: unknown;
}

/** Cache key of a folder. Sections are independent roots, so one id in two sections is two folders. */
export const folderKey = (sectionId: string, folderId: string) => `${sectionId}\u0000${folderId}`;

/**
 * Folder listings shared by the sidebar tree and the content view, so a folder is requested
 * once however many places show it. Each state object is replaced, never mutated, so
 * `useSyncExternalStore` can compare a single folder's state by identity.
 */
export const createFolderStore = () => {
    const states = new Map<string, FolderState>();
    const requests = new Map<string, AbortController>();
    const listeners = new Set<() => void>();

    const notify = () => listeners.forEach((listener) => listener());

    return {
        get: (key: string) => states.get(key),

        subscribe: (listener: () => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        /** Lists a folder unless it is loaded or already loading; `force` lists a loaded one again. */
        load(key: string, adapter: FileAdapter, folderId: string, force = false) {
            const current = states.get(key);

            if (requests.has(key) || (current?.status === "ready" && !force)) {
                return;
            }

            const controller = new AbortController();
            const settle = (state: FolderState) => {
                // A request that was aborted or replaced no longer owns the folder.
                if (requests.get(key) !== controller) {
                    return;
                }

                requests.delete(key);
                states.set(key, state);
                notify();
            };

            requests.set(key, controller);
            states.set(key, { status: "loading", entries: current?.entries });
            notify();

            // Wrapped so an adapter that throws synchronously still ends up as an error state.
            Promise.resolve()
                .then(() => adapter.list(folderId, { signal: controller.signal }))
                .then(
                    ({ entries }) => settle({ status: "ready", entries }),
                    (error: unknown) => settle({ status: "error", error }),
                );
        },

        /** Cancels every request in flight, e.g. on unmount, and forgets their loading state. */
        abortAll() {
            requests.forEach((controller, key) => {
                controller.abort();

                const entries = states.get(key)?.entries;

                if (entries) {
                    states.set(key, { status: "ready", entries });
                } else {
                    states.delete(key);
                }
            });

            requests.clear();
            notify();
        },
    };
};

export type FolderStore = ReturnType<typeof createFolderStore>;
