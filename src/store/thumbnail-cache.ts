import type { FileAdapter, FileEntry, ViewMode } from "../types";

/** How many thumbnails are asked for and loaded at once; the rest wait their turn. */
const MAX_ACTIVE = 6;

/** How many thumbnails are kept once nothing shows them, those shown longest ago going first. */
const MAX_KEPT = 1000;

/** A file's thumbnail for one view. */
interface Slot {
    /**
     * Shown in place of the icon once the picture has loaded; null until then, or when there's
     * none. While a larger one is asked for, the smaller one already here.
     */
    url: string | null;
    /** Made for a blob, and revoked as `url` gives way to another or the slot goes. */
    objectUrl: string | null;
    /** The file's size and date modified when it was asked for, so a changed file is asked for again. */
    version: string;
    status: "queued" | "loading" | "done";
    /** How many rendered entries show it. */
    users: number;
    adapter: FileAdapter;
    entry: FileEntry;
    view: ViewMode;
    /** The largest size wanted, which the picture is, or is being asked for at. */
    size: number;
    controller: AbortController | null;
}

const versionOf = (entry: FileEntry) => `${entry.size ?? ""}:${entry.modifiedAt?.getTime() ?? ""}`;

/**
 * Loads a picture before it's shown, so a URL or blob the browser can't draw leaves the icon in
 * place, and the picture shows at once when its entry renders it.
 */
const loadImage = (url: string, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const image = new Image();
        const stop = () => {
            // Stops the download.
            image.src = "";
            reject(signal.reason);
        };

        image.onload = () => {
            signal.removeEventListener("abort", stop);
            resolve();
        };
        image.onerror = () => {
            signal.removeEventListener("abort", stop);
            reject(new Error("Couldn't load the thumbnail."));
        };
        signal.addEventListener("abort", stop, { once: true });
        image.src = url;
    });

/**
 * Files' thumbnails, by adapter, view and entry id, asked for through the adapter's `thumbnail`
 * while an entry rendered wants one, `MAX_ACTIVE` at a time. Only the entries in or near view are
 * rendered, so only theirs are asked for, and one scrolled away before it came is aborted. Those
 * that came are kept, up to `MAX_KEPT` that nothing shows, so scrolling back shows them at once.
 */
export const createThumbnailCache = () => {
    // Least recently wanted first.
    const slots = new Map<string, Slot>();
    // Keys waiting to be asked for, in the order they were wanted.
    const queue = new Set<string>();
    const loading = new Set<Slot>();
    const listeners = new Map<string, Set<() => void>>();
    const adapterIds = new WeakMap<FileAdapter, number>();
    let nextAdapterId = 1;

    // Sections sharing an adapter share ids, so they share thumbnails too.
    const keyOf = (adapter: FileAdapter, view: ViewMode, entryId: string) => {
        let adapterId = adapterIds.get(adapter);

        if (adapterId === undefined) {
            adapterId = nextAdapterId++;
            adapterIds.set(adapter, adapterId);
        }

        return `${adapterId}\u0000${view}\u0000${entryId}`;
    };

    const notify = (key: string) => listeners.get(key)?.forEach((listener) => listener());

    // Forgets a slot, stopping its request and revoking its object URL.
    const drop = (key: string, slot: Slot) => {
        slots.delete(key);
        queue.delete(key);
        loading.delete(slot);
        slot.controller?.abort();

        if (slot.objectUrl) {
            URL.revokeObjectURL(slot.objectUrl);
        }
    };

    const start = (key: string, slot: Slot) => {
        const controller = new AbortController();
        const { signal } = controller;
        // Made for a blob, and revoked here unless the slot takes it.
        let objectUrl: string | null = null;

        slot.status = "loading";
        slot.controller = controller;
        loading.add(slot);

        // Wrapped so an adapter that throws synchronously still ends up with no thumbnail.
        Promise.resolve()
            .then(() => slot.adapter.thumbnail?.(slot.entry, { signal, view: slot.view, size: slot.size }) ?? null)
            .then(async (content) => {
                signal.throwIfAborted();

                if (!content) {
                    return null;
                }

                const url = content.url === undefined ? URL.createObjectURL(content.blob) : content.url;

                if (content.blob) {
                    objectUrl = url;
                }

                await loadImage(url, signal);

                return url;
            })
            // A thumbnail that fails leaves the icon, or the smaller picture, with nothing to tell the user.
            .catch(() => null)
            .then((url) => {
                // Dropped meanwhile, or asked for again at a larger size.
                const current = slot.controller === controller && loading.delete(slot);

                if (objectUrl && (!current || !url)) {
                    URL.revokeObjectURL(objectUrl);
                }

                if (!current) {
                    return;
                }

                slot.status = "done";
                slot.controller = null;

                if (url) {
                    if (slot.objectUrl) {
                        URL.revokeObjectURL(slot.objectUrl);
                    }

                    slot.url = url;
                    slot.objectUrl = objectUrl;
                }

                pump();
                evict();
                notify(key);
            });
    };

    // Asks for waiting thumbnails, in the order they were wanted, while there are free slots.
    const pump = () => {
        for (const key of queue) {
            if (loading.size >= MAX_ACTIVE) {
                break;
            }

            const slot = slots.get(key);

            queue.delete(key);

            if (slot) {
                start(key, slot);
            }
        }
    };

    // Forgets the thumbnails beyond `MAX_KEPT` that nothing shows, those wanted longest ago first.
    const evict = () => {
        let excess = slots.size - MAX_KEPT;

        for (const [key, slot] of slots) {
            if (excess <= 0) {
                break;
            }

            if (slot.users === 0) {
                drop(key, slot);
                excess -= 1;
            }
        }
    };

    return {
        /** The URL of a file's thumbnail for a view, once it has loaded; otherwise null. */
        get: (adapter: FileAdapter, view: ViewMode, entryId: string) =>
            slots.get(keyOf(adapter, view, entryId))?.url ?? null,

        /** Listens for a file's thumbnail for a view coming, or going. */
        subscribe(adapter: FileAdapter, view: ViewMode, entryId: string, listener: () => void) {
            const key = keyOf(adapter, view, entryId);
            const keyListeners = listeners.get(key) ?? new Set();

            keyListeners.add(listener);
            listeners.set(key, keyListeners);

            return () => {
                keyListeners.delete(listener);

                if (keyListeners.size === 0 && listeners.get(key) === keyListeners) {
                    listeners.delete(key);
                }
            };
        },

        /**
         * Asks for a file's thumbnail for a view, `size` device pixels square, unless it's kept or
         * on its way, at that size or larger. One kept smaller, as a view zoomed in wants, is asked
         * for again at this size, and shows meanwhile. Returns the function to call once the entry
         * no longer shows it, which stops a request no other entry is waiting on.
         */
        want(adapter: FileAdapter, entry: FileEntry, view: ViewMode, size: number) {
            const key = keyOf(adapter, view, entry.id);
            const version = versionOf(entry);
            let slot = slots.get(key);
            const changed = !!slot && slot.version !== version;

            if (slot && changed) {
                drop(key, slot);
                slot = undefined;
            }

            if (slot) {
                // Moved to the end, as the most recently wanted.
                slots.delete(key);

                // A file with none has none at any size.
                if (size > slot.size && (slot.status !== "done" || slot.url)) {
                    slot.size = size;
                    slot.entry = entry;

                    if (slot.status !== "queued") {
                        slot.controller?.abort();
                        slot.controller = null;
                        loading.delete(slot);
                        slot.status = "queued";
                        queue.add(key);
                    }
                }
            } else {
                slot = {
                    url: null,
                    objectUrl: null,
                    version,
                    status: "queued",
                    users: 0,
                    adapter,
                    entry,
                    view,
                    size,
                    controller: null,
                };
                queue.add(key);
            }

            const wanted = slot;
            let released = false;

            slots.set(key, wanted);
            wanted.users += 1;
            pump();

            // The file changed, and its old thumbnail went.
            if (changed) {
                notify(key);
            }

            return () => {
                if (released) {
                    return;
                }

                released = true;
                wanted.users -= 1;

                // Checked once the commit is over, so an entry rendered again at once, as it is
                // when the listing is refreshed, keeps its request going.
                queueMicrotask(() => {
                    if (wanted.users === 0 && wanted.status !== "done" && slots.get(key) === wanted) {
                        drop(key, wanted);
                        pump();
                    }

                    evict();
                });
            };
        },

        /** Stops every request and forgets every thumbnail, e.g. on unmount. The cache can still be used afterwards. */
        clear() {
            slots.forEach((slot, key) => drop(key, slot));
            listeners.forEach((_, key) => notify(key));
        },
    };
};

export type ThumbnailCache = ReturnType<typeof createThumbnailCache>;
