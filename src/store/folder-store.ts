import type { FileAdapter, FolderState } from "../types";

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
    // Counts the changes, for a view that reads many listings at once.
    let version = 0;

    const notify = () => {
        version += 1;
        listeners.forEach((listener) => listener());
    };

    /**
     * Ids of a folder and of the folders below it whose listings a section has cached, found
     * through the cached listings themselves, so no id is parsed. Empty when the folder's own
     * listing isn't cached.
     */
    const cachedTree = (sectionId: string, folderId: string) => {
        const found = new Set<string>();

        const visit = (id: string) => {
            const state = states.get(folderKey(sectionId, id));

            if (!state || found.has(id)) {
                return;
            }

            found.add(id);
            state.entries?.forEach((entry) => {
                if (entry.kind === "folder") {
                    visit(entry.id);
                }
            });
        };

        visit(folderId);

        return [...found];
    };

    /**
     * Lists a folder unless it is loaded or already loading. `force` lists it again either way,
     * replacing a request in flight, whose result could predate a change just made.
     */
    const load = (key: string, adapter: FileAdapter, folderId: string, force = false) => {
        const current = states.get(key);

        if (!force && (requests.has(key) || current?.status === "ready")) {
            return;
        }

        requests.get(key)?.abort();

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
    };

    return {
        get: (key: string) => states.get(key),

        /** Changes whenever any listing does, for a view that reads many of them, such as the sidebar tree. */
        version: () => version,

        subscribe: (listener: () => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        load,

        /**
         * Lists again, through `adapter`, a section's cached listings of the folders, and every
         * cached listing holding one of them, for its item count, e.g. after their contents changed.
         * All of the section's listings are looked through, found by the section's part of their
         * key, so none is missed and no folder id is parsed.
         */
        relist(sectionId: string, adapter: FileAdapter, folderIds: Iterable<string>) {
            const changed = new Set(folderIds);
            const prefix = folderKey(sectionId, "");

            [...states].forEach(([key, state]) => {
                const folderId = key.slice(prefix.length);

                if (
                    key.startsWith(prefix) &&
                    (changed.has(folderId) || state.entries?.some((entry) => changed.has(entry.id)))
                ) {
                    load(key, adapter, folderId, true);
                }
            });
        },

        cachedTree,

        /**
         * Drops the listings a section has cached for folders and for every folder below them, and
         * cancels their requests, e.g. when the folders were deleted, or their ids may now name others.
         */
        forget(sectionId: string, folderIds: Iterable<string>) {
            let dropped = false;

            [...folderIds]
                .flatMap((folderId) => cachedTree(sectionId, folderId))
                .forEach((id) => {
                    const key = folderKey(sectionId, id);

                    requests.get(key)?.abort();
                    requests.delete(key);
                    dropped = states.delete(key) || dropped;
                });

            if (dropped) {
                notify();
            }
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
