import type { FileAdapter, FileEntry, FolderState } from "../types";

/**
 * How often, at most, a folder listed for the first time in pages shows the pages that have come so
 * far, in ms; the first one shows at once. Every showing sorts the listing again, wherever it's shown.
 */
const PAGE_INTERVAL = 500;

/**
 * How many entries are kept in the listings nothing shows, those shown longest ago going first. Each
 * listing counts as one more than its entries, so empty folders count too.
 */
const MAX_KEPT = 20_000;

/** Cache key of a folder. Sections are independent roots, so one id in two sections is two folders. */
export const folderKey = (sectionId: string, folderId: string) => `${sectionId}\u0000${folderId}`;

/** The section and the folder a `folderKey` was made of; the section's part is the one before the first NUL. */
export const keyFolder = (key: string) => {
    const cut = key.indexOf("\u0000");

    return { sectionId: key.slice(0, cut), folderId: key.slice(cut + 1) };
};

// Plain objects and arrays, such as an entry's `meta` or `media`, which every listing brings anew.
const isPlain = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const prototype: unknown = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === Array.prototype || prototype === null;
};

// Dates are the same by their time, and plain objects and arrays by their own fields, while `depth` lasts.
const sameValue = (a: unknown, b: unknown, depth: number): boolean =>
    Object.is(a, b) ||
    (a instanceof Date && b instanceof Date && a.getTime() === b.getTime()) ||
    (depth > 0 && isPlain(a) && isPlain(b) && Array.isArray(a) === Array.isArray(b) && sameFields(a, b, depth - 1));

const sameFields = (a: object, b: object, depth: number) => {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);

    return (
        keys.length === Object.keys(right).length &&
        keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key], depth))
    );
};

// An entry a new listing brings as it was: every field the same, `meta`'s and `media`'s one level down.
const sameEntry = (a: FileEntry, b: FileEntry) =>
    a === b || (Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && sameFields(a, b, 1));

/**
 * A folder's new listing, keeping the entries of the one before that haven't changed, and the whole
 * listing before when nothing has, so what shows it renders only what changed, and a selection of
 * unchanged entries isn't told again.
 */
const withUnchanged = (before: FileEntry[] | undefined, listed: FileEntry[]) => {
    if (!before) {
        return listed;
    }

    const byId = new Map(before.map((entry) => [entry.id, entry] as const));
    let changed = before.length !== listed.length;

    const entries = listed.map((entry, index) => {
        const kept = byId.get(entry.id);

        if (kept && sameEntry(kept, entry)) {
            changed ||= before[index] !== kept;

            return kept;
        }

        changed = true;

        return entry;
    });

    return changed ? entries : before;
};

/**
 * Folder listings shared by the sidebar tree, the content view and the dialogs, so a folder is
 * requested once however many places show it. Each state object is replaced, never mutated, so
 * `useSyncExternalStore` can compare a single folder's state by identity.
 *
 * Listings are kept once listed, so a folder opened again shows at once, and `open` lists it again
 * in the background. Those nothing shows are dropped beyond `MAX_KEPT` entries.
 */
export const createFolderStore = () => {
    const states = new Map<string, FolderState>();
    const requests = new Map<string, AbortController>();
    // When each ready listing was asked for. One missing here may be out of date (`stale`), and is
    // listed again as it opens, whatever its age.
    const checkedAt = new Map<string, number>();
    // How many parts show each listing; one shown is never dropped to make room.
    const shown = new Map<string, number>();
    // Listed listings, by when they were last shown or listed, longest ago first.
    const recent = new Set<string>();
    const listeners = new Set<() => void>();
    // Counts the changes, for a view that reads many listings at once.
    let version = 0;

    const notify = () => {
        version += 1;
        listeners.forEach((listener) => listener());
    };

    const touch = (key: string) => {
        recent.delete(key);
        recent.add(key);
    };

    // Forgets a listing and cancels its request. Returns whether there was one.
    const drop = (key: string) => {
        requests.get(key)?.abort();
        requests.delete(key);
        checkedAt.delete(key);
        recent.delete(key);

        return states.delete(key);
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
     * Drops the listings nothing shows beyond `MAX_KEPT` entries, those shown longest ago first.
     * A listing only goes once no listing kept is found below it, through the folders it lists, so
     * `cachedTree` still finds every listing below a folder that changes.
     */
    const evict = () => {
        const weight = (key: string) => (states.get(key)?.entries?.length ?? 0) + 1;
        let kept = 0;

        recent.forEach((key) => {
            if (!shown.has(key)) {
                kept += weight(key);
            }
        });

        if (kept <= MAX_KEPT) {
            return;
        }

        // How many cached listings each listing has right below it, and the listings each one is in.
        const below = new Map<string, number>();
        const above = new Map<string, string[]>();

        states.forEach((state, key) => {
            const { sectionId } = keyFolder(key);

            state.entries?.forEach((entry) => {
                const child = entry.kind === "folder" ? folderKey(sectionId, entry.id) : key;

                if (child !== key && states.has(child)) {
                    below.set(key, (below.get(key) ?? 0) + 1);
                    above.set(child, [...(above.get(child) ?? []), key]);
                }
            });
        });

        let going = true;

        // Dropping a listing can leave the one it's in with nothing kept below it, so it's gone
        // through again until enough has gone or nothing more can.
        while (kept > MAX_KEPT && going) {
            going = false;

            for (const key of recent) {
                if (kept <= MAX_KEPT) {
                    break;
                }

                if (!shown.has(key) && !requests.has(key) && !below.get(key)) {
                    kept -= weight(key);
                    above.get(key)?.forEach((parent) => below.set(parent, (below.get(parent) ?? 1) - 1));
                    drop(key);
                    going = true;
                }
            }
        }
    };

    /**
     * Asks the adapter for a folder's listing, replacing a request in flight. A folder the adapter
     * lists in pages is asked for page after page, as long as each hands back a cursor. Listed for
     * the first time, it shows what has come so far as it goes (`partial`); listed again, the
     * listing it had stays until the new one is complete, shown loading, or `quiet`ly, as ready
     * but `checking`. The new listing keeps the entries that came back as they were.
     */
    const request = (key: string, adapter: FileAdapter, folderId: string, quiet: boolean) => {
        const current = states.get(key);

        requests.get(key)?.abort();

        const controller = new AbortController();
        const { signal } = controller;
        const askedAt = performance.now();
        // A request that was aborted or replaced no longer owns the folder.
        const owns = () => requests.get(key) === controller;

        const settle = (state: FolderState) => {
            if (!owns()) {
                return;
            }

            requests.delete(key);
            touch(key);

            if (state.status === "ready") {
                checkedAt.set(key, askedAt);
            } else {
                checkedAt.delete(key);
            }

            states.set(key, state);
            evict();
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
                        settle({ status: "ready", entries: withUnchanged(states.get(key)?.entries, entries) });

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
        // Listed again quietly, the folder stays ready, so nothing shows it loading or waits for all
        // of it, but it's `checking`.
        states.set(
            key,
            quiet
                ? { status: "ready", entries: current?.entries, checking: true }
                : { status: "loading", entries: current?.entries, partial: current?.partial },
        );
        notify();

        listPage().catch((error: unknown) => settle({ status: "error", error }));
    };

    /**
     * Lists a folder unless it is loaded or already loading. `force` lists it again either way,
     * replacing a request in flight, whose result could predate a change just made.
     */
    const load = (key: string, adapter: FileAdapter, folderId: string, force = false) => {
        if (force || !(requests.has(key) || states.get(key)?.status === "ready")) {
            request(key, adapter, folderId, false);
        }
    };

    /**
     * Lists a folder being opened, in the content, the sidebar tree or the picker: as `load` does
     * when it hasn't been listed or listing it failed, or else again in the background once its
     * listing was asked for `maxAge` ms ago or more, or may be out of date (`stale`). Meanwhile the
     * listing shows as it is, ready but `checking`.
     */
    const open = (key: string, adapter: FileAdapter, folderId: string, maxAge: number) => {
        const at = checkedAt.get(key);

        if (states.get(key)?.status !== "ready" || requests.has(key)) {
            load(key, adapter, folderId);
        } else if (at === undefined || performance.now() - at >= maxAge) {
            request(key, adapter, folderId, true);
        }
    };

    /**
     * Marks a section's listings as maybe out of date, after a change the file manager can't tie to
     * every folder it touched, so each is listed again as it opens, whatever its age.
     */
    const stale = (sectionId: string) => {
        const prefix = folderKey(sectionId, "");

        [...checkedAt.keys()].forEach((key) => {
            if (key.startsWith(prefix)) {
                checkedAt.delete(key);
            }
        });
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

        open,

        /**
         * Tells the store a folder's listing is shown, so it isn't dropped to make room while it
         * is, and `recheck` lists it again. Returns the function to call once it isn't.
         */
        show(key: string) {
            let hidden = false;

            shown.set(key, (shown.get(key) ?? 0) + 1);

            if (recent.has(key)) {
                touch(key);
            }

            return () => {
                if (hidden) {
                    return;
                }

                const count = (shown.get(key) ?? 1) - 1;

                hidden = true;

                if (count > 0) {
                    shown.set(key, count);
                } else {
                    shown.delete(key);
                }

                if (recent.has(key)) {
                    touch(key);
                }
            };
        },

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

        stale,

        /**
         * As `stale`, and lists again at once, through `adapter`, the section's listings that are
         * shown: quietly those that are ready, and those still loading afresh, since their result
         * could predate the change. One that failed stays as it is.
         */
        recheck(sectionId: string, adapter: FileAdapter) {
            const prefix = folderKey(sectionId, "");

            stale(sectionId);
            shown.forEach((_, key) => {
                const status = states.get(key)?.status;

                if (key.startsWith(prefix) && status !== undefined && status !== "error") {
                    request(key, adapter, keyFolder(key).folderId, status === "ready");
                }
            });
        },

        /** Whether one of a section's listings lists one of the entries, so the section has it below its root. */
        lists(sectionId: string, entryIds: ReadonlySet<string>) {
            const prefix = folderKey(sectionId, "");

            return [...states].some(
                ([key, state]) => key.startsWith(prefix) && !!state.entries?.some((entry) => entryIds.has(entry.id)),
            );
        },

        cachedTree,

        /**
         * Drops the listings a section has cached for folders and for every folder below them, and
         * cancels their requests, e.g. when the folders were deleted, or their ids may now name
         * others. What still shows one lists it afresh (`useFolder`, `useTreeRows`).
         */
        forget(sectionId: string, folderIds: Iterable<string>) {
            let dropped = false;

            [...folderIds]
                .flatMap((folderId) => cachedTree(sectionId, folderId))
                .forEach((id) => {
                    dropped = drop(folderKey(sectionId, id)) || dropped;
                });

            if (dropped) {
                notify();
            }
        },

        /**
         * Drops every listing a section has cached and cancels its requests, e.g. when another
         * adapter serves it, whose ids its listings mean nothing to. What shows them lists them again.
         */
        forgetSection(sectionId: string) {
            const prefix = folderKey(sectionId, "");
            let dropped = false;

            [...states.keys(), ...requests.keys()].forEach((key) => {
                if (key.startsWith(prefix)) {
                    dropped = drop(key) || dropped;
                }
            });

            if (dropped) {
                notify();
            }
        },

        /**
         * Cancels every request in flight, e.g. on unmount, and forgets their loading state. A
         * listing being listed again is kept, as maybe out of date; one only partly listed is
         * dropped, to be listed again.
         */
        abortAll() {
            requests.forEach((controller, key) => {
                const state = states.get(key);

                controller.abort();
                checkedAt.delete(key);

                if (state?.entries && !state.partial) {
                    states.set(key, { status: "ready", entries: state.entries });
                } else {
                    states.delete(key);
                    recent.delete(key);
                }
            });

            requests.clear();
            notify();
        },
    };
};

export type FolderStore = ReturnType<typeof createFolderStore>;
