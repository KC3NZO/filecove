import type {
    ConflictPolicy,
    FileAdapter,
    FileEntry,
    FolderRef,
    TransferItem,
    TransferKind,
    TransferOptions,
} from "../types";

/** How many copies and moves the adapter carries out at once; the rest wait their turn. */
const MAX_ACTIVE = 3;

/** How long a copy or move may take before the panel shows it, in ms, so a quick one is never shown. */
const SHOW_AFTER = 500;

/**
 * How often, at most, progress is told to the listeners, in ms, since an adapter may report every
 * few kilobytes.
 */
const PROGRESS_INTERVAL = 100;

/**
 * How a copy or move ended: done or cancelled, which take it out of the queue, or failed, which
 * leaves it there to be shown.
 */
export type TransferOutcome = "done" | "failed" | "cancelled";

const isActive = (item: TransferItem) => item.status === "queued" || item.status === "running";

const call = ({ kind, adapter, entries, target }: TransferItem, options: TransferOptions) => {
    const run = kind === "copy" ? adapter.copy : adapter.move;

    if (!run) {
        throw new Error(`The adapter has no ${kind}.`);
    }

    return run.call(adapter, entries, target.id, options);
};

/**
 * Copies and moves waiting their turn, being carried out by the adapter, or failed, independent of
 * any view, so they carry on while the user browses. Each is one call to the adapter, with
 * `MAX_ACTIVE` running at once, and one asked to wait for another (`after`) starting once that one
 * has ended, however it did. One that's done or cancelled leaves the queue; a failed one stays
 * until it's forgotten. The item list is replaced, never mutated, so `useSyncExternalStore` can
 * compare it by identity.
 *
 * `onEnded` is told as each ends, with the item as it was, and the items as they are now: done,
 * failed, or cancelled, when its status says whether it had reached the adapter ("running") or was
 * still waiting ("queued"). The adapter can't undo what it has done, so whatever reached it may have
 * changed folders, however it ended.
 */
export const createTransferQueue = (
    onEnded: (item: TransferItem, outcome: TransferOutcome, items: TransferItem[]) => void,
) => {
    let items: TransferItem[] = [];
    let nextId = 1;
    const controllers = new Map<number, AbortController>();
    const timers = new Map<number, number>();
    const listeners = new Set<() => void>();

    const notify = () => listeners.forEach((listener) => listener());

    // Progress is told at most every `PROGRESS_INTERVAL`, and with whatever else changes meanwhile.
    let progressTimer: number | undefined;

    const notifyProgress = () => {
        progressTimer ??= window.setTimeout(() => {
            progressTimer = undefined;
            notify();
        }, PROGRESS_INTERVAL);
    };

    const find = (id: number) => items.find((item) => item.id === id);

    // Whether a waiting copy or move still waits for the one it comes after, which waits or runs.
    const waits = (item: TransferItem) => {
        const before = item.after === undefined ? undefined : find(item.after);

        return !!before && isActive(before);
    };

    const update = (id: number, change: Partial<TransferItem>) => {
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

    // Shown once it has taken a moment; a failed one is shown at once.
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

    const start = (item: TransferItem) => {
        const controller = new AbortController();
        const { signal } = controller;

        controllers.set(item.id, controller);
        update(item.id, { status: "running", progress: undefined, error: undefined });

        // A cancelled copy or move no longer owns its item.
        const owns = () => controllers.get(item.id) === controller;

        const settle = (outcome: TransferOutcome, change?: Partial<TransferItem>) => {
            if (!owns()) {
                return;
            }

            const ended = find(item.id);

            controllers.delete(item.id);

            if (change) {
                forgetTimer(item.id);
                update(item.id, change);
            } else {
                remove(item.id);
            }

            if (ended) {
                onEnded(find(item.id) ?? ended, outcome, items);
            }

            pump();
            notify();
        };

        // Wrapped so an adapter that throws synchronously still ends up as a failure. One aborted
        // before it reached the adapter never starts.
        Promise.resolve()
            .then(() => {
                signal.throwIfAborted();

                return call(item, {
                    signal,
                    conflict: item.conflict,
                    onProgress: (loaded, total) => {
                        if (owns() && total > 0) {
                            update(item.id, { progress: { loaded: Math.min(Math.max(loaded, 0), total), total } });
                            notifyProgress();
                        }
                    },
                });
            })
            .then(
                () => settle("done"),
                (error: unknown) =>
                    settle("failed", {
                        status: "failed",
                        shown: true,
                        // Without a message, the panel says why in its own words.
                        error: error instanceof Error && error.message ? error.message : undefined,
                    }),
            );
    };

    // Starts waiting copies and moves, in the order they were asked for, while there are free slots,
    // each after the one it waits for has ended.
    const pump = () => {
        let free = MAX_ACTIVE - controllers.size;

        for (const item of items) {
            if (free <= 0) {
                break;
            }

            if (item.status === "queued" && !waits(item)) {
                start(item);
                free -= 1;
            }
        }
    };

    // Takes a waiting or running copy or move out of the queue, aborting the call under way.
    const stop = (item: TransferItem) => {
        controllers.get(item.id)?.abort();
        controllers.delete(item.id);
        remove(item.id);
        onEnded(item, "cancelled", items);
    };

    return {
        /** Every copy and move waiting, under way or failed, in the order asked for, shown or not. */
        getItems: () => items,

        subscribe: (listener: () => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        /**
         * Asks `adapter` to copy or move `entries`, which are in `source`, into `target`, settling
         * names it already has by `conflict`, once the one with the id `after` has ended, when
         * given. Returns its id, for a host keeping something of its own about it.
         */
        add(
            kind: TransferKind,
            adapter: FileAdapter,
            entries: FileEntry[],
            source: FolderRef,
            target: FolderRef,
            conflict: ConflictPolicy,
            after?: number,
        ) {
            const id = nextId++;

            items = [
                ...items,
                { id, kind, adapter, entries, source, target, conflict, after, status: "queued", shown: false },
            ];
            showLater(id);
            pump();
            notify();

            return id;
        },

        /** Cancels a copy or move that is waiting or under way. */
        cancel(id: number) {
            const item = find(id);

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

        /** Forgets a failed copy or move, as it's asked for again. */
        forget(id: number) {
            if (find(id)?.status === "failed") {
                remove(id);
                notify();
            }
        },

        /** Forgets every failed copy and move, leaving those waiting or under way. */
        clear() {
            const failed = items.filter((item) => item.status === "failed");

            if (failed.length > 0) {
                failed.forEach((item) => remove(item.id));
                notify();
            }
        },

        /**
         * Cancels and forgets every copy and move, e.g. on unmount, telling `onEnded` nothing. The
         * queue can still be used afterwards.
         */
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

export type TransferQueue = ReturnType<typeof createTransferQueue>;
