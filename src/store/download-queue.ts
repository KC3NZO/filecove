import { prepareDownload, saveFile } from "../utils/download";

import type { DownloadItem, EntriesInFolder, FileAdapter, FileEntry } from "../types";

/** How many downloads the adapter prepares at once by default; the rest wait their turn. */
const MAX_ACTIVE = 3;

/** How long a download may take before the panel shows it, in ms, so a quick one starts with nothing shown. */
const SHOW_AFTER = 500;

/**
 * How often, at most, progress is told to the listeners, in ms, since an adapter counting the bytes
 * of a response as they're read may report every few kilobytes.
 */
const PROGRESS_INTERVAL = 100;

const isActive = (item: DownloadItem) => item.status === "queued" || item.status === "preparing";

const sameEntries = (item: DownloadItem, adapter: FileAdapter, entries: readonly FileEntry[]) =>
    item.adapter === adapter &&
    item.entries.length === entries.length &&
    item.entries.every((entry, index) => entry.id === entries[index].id);

/**
 * Downloads waiting to be prepared, being prepared by the adapter, or needing the user, independent
 * of any view, so they carry on while the user browses. Each is one call to the adapter, with
 * `MAX_ACTIVE` running at once unless `setMaxActive` says otherwise, and leaves the queue once the browser has the file, whose own
 * downloads show it from there. The item list is replaced, never mutated, so
 * `useSyncExternalStore` can compare it by identity.
 */
export const createDownloadQueue = () => {
    let items: DownloadItem[] = [];
    let nextId = 1;
    const controllers = new Map<number, AbortController>();
    const timers = new Map<number, number>();
    const listeners = new Set<() => void>();
    let maxActive = MAX_ACTIVE;

    const notify = () => listeners.forEach((listener) => listener());

    // Progress is told at most every `PROGRESS_INTERVAL`, and with whatever else changes meanwhile.
    let progressTimer: number | undefined;

    const notifyProgress = () => {
        progressTimer ??= window.setTimeout(() => {
            progressTimer = undefined;
            notify();
        }, PROGRESS_INTERVAL);
    };

    const update = (id: number, change: Partial<DownloadItem>) => {
        items = items.map((item) => (item.id === id ? { ...item, ...change } : item));
    };

    const forgetTimer = (id: number) => {
        window.clearTimeout(timers.get(id));
        timers.delete(id);
    };

    const remove = (id: number) => {
        forgetTimer(id);
        items = items.filter((item) => item.id !== id);
    };

    // Shown once it has taken a moment; a download that needs the user is shown at once.
    const showLater = (id: number) => {
        timers.set(
            id,
            window.setTimeout(() => {
                timers.delete(id);
                update(id, { shown: true });
                notify();
            }, SHOW_AFTER),
        );
    };

    const start = (item: DownloadItem) => {
        const controller = new AbortController();
        const { signal } = controller;

        controllers.set(item.id, controller);
        update(item.id, { status: "preparing", progress: undefined, error: undefined });

        // A cancelled download no longer owns its item.
        const owns = () => controllers.get(item.id) === controller;

        const settle = (settled: () => void) => {
            if (!owns()) {
                return;
            }

            controllers.delete(item.id);
            settled();
            pump();
            notify();
        };

        // Wrapped so an adapter that throws synchronously still ends up as a failure.
        Promise.resolve()
            .then(() => {
                signal.throwIfAborted();

                return prepareDownload(item, {
                    signal,
                    onProgress: (loaded, total) => {
                        if (owns() && total > 0) {
                            update(item.id, { progress: { loaded: Math.min(Math.max(loaded, 0), total), total } });
                            notifyProgress();
                        }
                    },
                });
            })
            .then(
                (prepared) =>
                    settle(() => {
                        if (saveFile(prepared)) {
                            remove(item.id);
                        } else {
                            forgetTimer(item.id);
                            update(item.id, { status: "ready", shown: true, prepared });
                        }
                    }),
                (error: unknown) =>
                    settle(() => {
                        forgetTimer(item.id);
                        update(item.id, {
                            status: "failed",
                            shown: true,
                            // Without a message, the panel says why in its own words.
                            error: error instanceof Error && error.message ? error.message : undefined,
                        });
                    }),
            );
    };

    // Starts waiting downloads, in the order they were asked for, while there are free slots.
    const pump = () => {
        let free = maxActive - controllers.size;

        for (const item of items) {
            if (free <= 0) {
                break;
            }

            if (item.status === "queued") {
                start(item);
                free -= 1;
            }
        }
    };

    const stop = (id: number) => {
        controllers.get(id)?.abort();
        controllers.delete(id);
        remove(id);
    };

    return {
        /** Every download not yet taken by the browser, in the order asked for, shown or not. */
        getItems: () => items,

        subscribe: (listener: () => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        /**
         * Asks for `entries` as one file to save, through `adapter`, which hands them over, or with
         * `groups`, the entries of several folders, through its `downloadAcross`. The same entries
         * asked for again while they're being prepared are left to that download; one of them that
         * failed or is ready is replaced.
         */
        add(
            adapter: FileAdapter,
            entries: FileEntry[],
            folderName: string,
            showHidden: boolean,
            groups?: EntriesInFolder[],
        ) {
            const same = items.filter((item) => sameEntries(item, adapter, entries));

            if (entries.length === 0 || same.some(isActive)) {
                return;
            }

            same.forEach((item) => remove(item.id));

            const id = nextId++;

            items = [
                ...items,
                { id, adapter, entries, groups, folderName, showHidden, status: "queued", shown: false },
            ];
            showLater(id);
            pump();
            notify();
        },

        /** Cancels a download that is waiting or being prepared. */
        cancel(id: number) {
            const item = items.find((candidate) => candidate.id === id);

            if (item && isActive(item)) {
                stop(id);
                pump();
                notify();
            }
        },

        cancelAll() {
            const active = items.filter(isActive);

            if (active.length > 0) {
                active.forEach((item) => stop(item.id));
                notify();
            }
        },

        /** Asks the adapter again for a failed download, from the start, still shown. */
        retry(id: number) {
            const item = items.find((candidate) => candidate.id === id);

            if (item?.status === "failed") {
                update(id, { status: "queued", progress: undefined, error: undefined });
                pump();
                notify();
            }
        },

        /** Saves a ready download, from the click that asks for it, so the browser doesn't block its tab. */
        save(id: number) {
            const item = items.find((candidate) => candidate.id === id);

            if (item?.status === "ready" && item.prepared && saveFile(item.prepared)) {
                remove(id);
                notify();
            }
        },

        /**
         * Sets how many downloads are prepared at once, `MAX_ACTIVE` when omitted. A higher count starts those
         * waiting at once; a lower one lets those under way finish.
         */
        setMaxActive(count = MAX_ACTIVE) {
            maxActive = count;
            pump();
            notify();
        },

        /** Forgets every failed and ready download, leaving those waiting or being prepared. */
        clear() {
            const ended = items.filter((item) => !isActive(item));

            if (ended.length > 0) {
                ended.forEach((item) => remove(item.id));
                notify();
            }
        },

        /** Cancels and forgets every download, e.g. on unmount. The queue can still be used afterwards. */
        abortAll() {
            window.clearTimeout(progressTimer);
            progressTimer = undefined;
            controllers.forEach((controller) => controller.abort());
            controllers.clear();
            timers.forEach((timer) => window.clearTimeout(timer));
            timers.clear();
            items = [];
            notify();
        },
    };
};

export type DownloadQueue = ReturnType<typeof createDownloadQueue>;
