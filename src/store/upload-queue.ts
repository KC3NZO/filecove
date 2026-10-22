import type { ConflictPolicy, FileAdapter, FolderRef, UploadItem } from "../types";

/** How many files are sent at once; the rest wait their turn. */
const MAX_ACTIVE = 3;

/** How often, at most, the folders uploads ended in are reported, in ms. */
const REPORT_INTERVAL = 1000;

const isActive = (item: UploadItem) => item.status === "queued" || item.status === "uploading";

/**
 * Files waiting to be uploaded, being uploaded, or done with, independent of any view, so uploads
 * carry on in the background while the user browses. Each file is its own call to the adapter,
 * with `MAX_ACTIVE` running at once. The item list is replaced, never mutated, so
 * `useSyncExternalStore` can compare it by identity.
 *
 * `onChanged` is told the folders uploads that reached the adapter ended in, done, failed or
 * cancelled, to list them again. It's called at most once every `REPORT_INTERVAL`, so a folder
 * taking many small files isn't listed again for each one.
 */
export const createUploadQueue = (onChanged: (adapter: FileAdapter, folderIds: string[]) => void) => {
    let items: UploadItem[] = [];
    let nextId = 1;
    const controllers = new Map<number, AbortController>();
    const listeners = new Set<() => void>();

    const notify = () => listeners.forEach((listener) => listener());

    const update = (id: number, change: Partial<UploadItem>) => {
        items = items.map((item) => (item.id === id ? { ...item, ...change } : item));
    };

    // Folders waiting to be reported, by adapter. The first is reported at once, and any that
    // follow within `REPORT_INTERVAL` together at its end.
    const due = new Map<FileAdapter, Set<string>>();
    let timer: number | undefined;

    const report = () => {
        timer = undefined;

        if (due.size === 0) {
            return;
        }

        const reported = [...due];

        due.clear();
        timer = window.setTimeout(report, REPORT_INTERVAL);
        reported.forEach(([adapter, folderIds]) => onChanged(adapter, [...folderIds]));
    };

    const changed = (item: UploadItem) => {
        due.set(item.adapter, (due.get(item.adapter) ?? new Set()).add(item.folder.id));

        if (timer === undefined) {
            report();
        }
    };

    const start = (item: UploadItem) => {
        const controller = new AbortController();
        const { signal } = controller;

        controllers.set(item.id, controller);
        update(item.id, { status: "uploading", progress: undefined, error: undefined });

        // A cancelled upload no longer owns its item.
        const owns = () => controllers.get(item.id) === controller;

        const settle = (change: Partial<UploadItem>) => {
            if (!owns()) {
                return;
            }

            controllers.delete(item.id);
            update(item.id, change);
            changed(item);
            pump();
            notify();
        };

        // Wrapped so an adapter that throws synchronously still ends up as a failure.
        Promise.resolve()
            .then(() => {
                signal.throwIfAborted();

                if (!item.adapter.upload) {
                    throw new Error("Not supported here.");
                }

                return item.adapter.upload(item.file, item.folder.id, {
                    signal,
                    conflict: item.conflict,
                    onProgress: (loaded, total) => {
                        if (owns() && total > 0) {
                            update(item.id, { progress: Math.min(Math.max(loaded / total, 0), 1) });
                            notify();
                        }
                    },
                });
            })
            .then(
                () => settle({ status: "done", progress: 1 }),
                (error: unknown) =>
                    settle({
                        status: "failed",
                        // Without a message, the panel says why in its own words.
                        error: error instanceof Error && error.message ? error.message : undefined,
                    }),
            );
    };

    // Starts waiting uploads, in the order they were added, while there are free slots.
    const pump = () => {
        let free = MAX_ACTIVE - controllers.size;

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

    // An upload that reached the adapter may have made the file by the time it's aborted, so its
    // folder is listed again.
    const stop = (item: UploadItem) => {
        const controller = controllers.get(item.id);

        controllers.delete(item.id);
        controller?.abort();
        update(item.id, { status: "cancelled" });

        if (controller) {
            changed(item);
        }
    };

    return {
        /** Every file in the queue, in the order added, ended ones included until `clear`. */
        getItems: () => items,

        subscribe: (listener: () => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        /** Queues files to be uploaded into `folder` through `adapter`, which takes uploads. */
        add(adapter: FileAdapter, folder: FolderRef, files: File[], conflict: ConflictPolicy) {
            if (files.length === 0) {
                return;
            }

            items = [
                ...items,
                ...files.map((file): UploadItem => ({ id: nextId++, file, adapter, folder, conflict, status: "queued" })),
            ];
            pump();
            notify();
        },

        /** Cancels an upload that is waiting or under way. */
        cancel(id: number) {
            const item = items.find((candidate) => candidate.id === id);

            if (item && isActive(item)) {
                stop(item);
                pump();
                notify();
            }
        },

        cancelAll() {
            const active = items.filter(isActive);

            if (active.length > 0) {
                active.forEach(stop);
                notify();
            }
        },

        /** Queues a failed or cancelled upload again, from the start. */
        retry(id: number) {
            const item = items.find((candidate) => candidate.id === id);

            if (item && (item.status === "failed" || item.status === "cancelled")) {
                update(id, { status: "queued", progress: undefined, error: undefined });
                pump();
                notify();
            }
        },

        /** Forgets every upload that has ended, leaving those waiting or under way. */
        clear() {
            const kept = items.filter(isActive);

            if (kept.length !== items.length) {
                items = kept;
                notify();
            }
        },

        /**
         * Cancels every upload, e.g. on unmount, and stops reporting folders. The queue can still
         * be used afterwards.
         */
        abortAll() {
            window.clearTimeout(timer);
            timer = undefined;
            due.clear();
            controllers.forEach((controller) => controller.abort());
            controllers.clear();
            items = items.map((item) => (isActive(item) ? { ...item, status: "cancelled" } : item));
            notify();
        },
    };
};

export type UploadQueue = ReturnType<typeof createUploadQueue>;
