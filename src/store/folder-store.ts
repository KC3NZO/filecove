import type { FileAdapter, FileEntry, FolderState } from "../types";

/**
 * How often, at most, a folder listed for the first time in pages shows the pages that have come so
 * far, in ms; the first one shows at once. Every showing sorts the listing again, wherever it's shown.
 */
const PAGE_INTERVAL = 500;

/** Cache key of a folder. Sections are independent roots, so one id in two sections is two folders. */
export const folderKey = (sectionId: string, folderId: string) => `${sectionId}\u0000${folderId}`;

/** The section and the folder a `folderKey` was made of; the section's part is the one before the first NUL. */
export const keyFolder = (key: string) => {
    const cut = key.indexOf("\u0000");

    return { sectionId: key.slice(0, cut), folderId: key.slice(cut + 1) };
};

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
     *
     * A folder the adapter lists in pages is asked for page after page, as long as each hands back
     * a cursor. Listed for the first time, it shows what has come so far as it goes (`partial`);
     * listed again, the listing it had stays until the new one is complete.
     */
    const load = (key: string, adapter: FileAdapter, folderId: string, force = false) => {
        const current = states.get(key);

        if (!force && (requests.has(key) || current?.status === "ready")) {
            return;
        }

        requests.get(key)?.abort();

        const controller = new AbortController();
        const { signal } = controller;
        // A request that was aborted or replaced no longer owns the folder.
        const owns = () => requests.get(key) === controller;

        const settle = (state: FolderState) => {
            if (!owns()) {
                return;
            }

            requests.delete(key);
            states.set(key, state);
            notify();
        };

        const progressive = !current?.entries || !!current.partial;
        const entries: FileEntry[] = [];
        // An entry a later page repeats, as offset paging can while the folder changes, is listed once.
        const listed = new Set<string>();
        let shownAt = -Infinity;

        // Wrapped so an adapter that throws synchronously still ends up as an error state.
        const listPage = (cursor?: string): Promise<void> =>
            Promise.resolve()
                .then(() => adapter.list(folderId, { signal, cursor }))
                .then(({ entries: page, nextCursor }) => {
                    if (!owns()) {
                        return;
                    }

                    page.forEach((entry) => {
                        if (!listed.has(entry.id)) {
                            listed.add(entry.id);
                            entries.push(entry);
                        }
                    });

                    if (!nextCursor) {
                        settle({ status: "ready", entries });

                        return;
                    }

                    // Asked for the same page again and again, it would never end.
                    if (nextCursor === cursor) {
                        throw new Error("The adapter's list returned the cursor it was given.");
                    }

                    if (progressive && entries.length > 0 && performance.now() - shownAt >= PAGE_INTERVAL) {
                        shownAt = performance.now();
                        states.set(key, { status: "loading", entries: entries.slice(), partial: true });
                        notify();
                    }

                    return listPage(nextCursor);
                });

        requests.set(key, controller);
        states.set(key, { status: "loading", entries: current?.entries, partial: current?.partial });
        notify();

        listPage().catch((error: unknown) => settle({ status: "error", error }));
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
         * cached listing holding one of them, for its item count, e.g. after their contents changed,
         * or every listing the section has cached when `folderIds` is omitted. All of the section's
         * listings are looked through, found by the section's part of their key, so none is missed
         * and no folder id is parsed.
         */
        relist(sectionId: string, adapter: FileAdapter, folderIds?: Iterable<string>) {
            const changed = folderIds && new Set(folderIds);
            const prefix = folderKey(sectionId, "");

            [...states].forEach(([key, state]) => {
                const folderId = key.slice(prefix.length);

                if (
                    key.startsWith(prefix) &&
                    (!changed || changed.has(folderId) || state.entries?.some((entry) => changed.has(entry.id)))
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

        /**
         * Cancels every request in flight, e.g. on unmount, and forgets their loading state. A
         * listing being replaced is kept; one only partly listed is dropped, to be listed again.
         */
        abortAll() {
            requests.forEach((controller, key) => {
                controller.abort();

                const state = states.get(key);

                if (state?.entries && !state.partial) {
                    states.set(key, { status: "ready", entries: state.entries });
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
