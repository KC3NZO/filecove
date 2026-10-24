import type { CountTarget, EntryProperties, EntryTotals, FileAdapter, FileEntry, Requested } from "../types";

/**
 * How long something stays shown before the adapter is asked about it, in ms, so moving through a
 * list with the arrow keys asks only about where it stops.
 */
const ASK_AFTER = 200;

/** How often, at most, totals counted so far are told to the listeners, in ms. */
const PROGRESS_INTERVAL = 150;

/** How many counts are kept once nothing shows them, the ones asked for longest ago going first. */
const MAX_KEPT_COUNTS = 30;

const NO_TOTALS: EntryTotals = { files: 0, folders: 0, size: 0 };

const sumTotals = (all: readonly EntryTotals[]) =>
    all.reduce(
        (sum, totals) => ({
            files: sum.files + totals.files,
            folders: sum.folders + totals.folders,
            size: sum.size + totals.size,
        }),
        NO_TOTALS,
    );

/** Folders counted together, for what the file manager had changed by then. */
interface Count {
    targets: readonly CountTarget[];
    /** The host's count of its changes when it was asked for, so what a change made is counted again. */
    changes: number;
    showHidden: boolean;
    state: Requested<EntryTotals>;
    /** How many panels show it. */
    users: number;
    /** Waiting out `ASK_AFTER`. */
    timer: number | undefined;
    controller: AbortController | null;
}

const sameTargets = (a: readonly CountTarget[], b: readonly CountTarget[]) =>
    a.length === b.length &&
    a.every((target, index) => target.entry === b[index].entry && target.adapter === b[index].adapter);

/**
 * What adapters handed over for the properties panel: an entry's properties (`properties`), kept by
 * the entry object, which a listing keeps for as long as the entry is as it was, and what's in
 * folders (`measure`), kept by the folders' entries, whether hidden files show, and the host's count
 * of its changes, so a change counts them again. Each is asked for once it has been wanted for
 * `ASK_AFTER`, and stopped if it stops being wanted before it has come. It imports nothing from
 * the file manager, so the media manager can use it too.
 */
export const createPropertiesCache = () => {
    const details = new WeakMap<FileEntry, Requested<EntryProperties>>();
    // Asked for longest ago first.
    let counts: Count[] = [];
    const listeners = new Set<() => void>();
    let version = 0;

    const notify = () => {
        version += 1;
        listeners.forEach((listener) => listener());
    };

    // Totals counted so far are told at most every `PROGRESS_INTERVAL`.
    let progressTimer: number | undefined;

    const notifyProgress = () => {
        progressTimer ??= window.setTimeout(() => {
            progressTimer = undefined;
            notify();
        }, PROGRESS_INTERVAL);
    };

    const find = (targets: readonly CountTarget[], changes: number, showHidden: boolean) =>
        counts.find(
            (count) =>
                count.changes === changes && count.showHidden === showHidden && sameTargets(count.targets, targets),
        );

    // Forgets the counts nothing shows beyond `MAX_KEPT_COUNTS`, those asked for longest ago first.
    const evict = () => {
        let excess = counts.length - MAX_KEPT_COUNTS;

        counts = counts.filter((count) => {
            if (excess > 0 && count.users === 0) {
                excess -= 1;

                return false;
            }

            return true;
        });
    };

    // Each adapter counts its own folders, and their totals are added up, as are the totals each
    // reports on the way.
    const start = (count: Count) => {
        const controller = new AbortController();
        const { signal } = controller;
        const groups = new Map<FileAdapter, FileEntry[]>();

        count.controller = controller;
        count.targets.forEach(({ entry, adapter }) => groups.set(adapter, [...(groups.get(adapter) ?? []), entry]));

        const reported = [...groups.keys()].map(() => NO_TOTALS);

        Promise.all(
            [...groups].map(([adapter, folders], index) =>
                // Wrapped so an adapter that throws synchronously still fails the count.
                Promise.resolve().then(() => {
                    if (!adapter.measure) {
                        throw new Error("The adapter has no `measure`.");
                    }

                    return adapter.measure(folders, {
                        signal,
                        showHidden: count.showHidden,
                        onProgress: (totals) => {
                            if (signal.aborted || count.state.status !== "loading") {
                                return;
                            }

                            reported[index] = totals;
                            count.state = { status: "loading", progress: sumTotals(reported) };
                            notifyProgress();
                        },
                    });
                }),
            ),
        )
            .then(
                (all): Requested<EntryTotals> => ({ status: "ready", value: sumTotals(all) }),
                (error: unknown): Requested<EntryTotals> => ({ status: "error", error }),
            )
            .then((state) => {
                if (signal.aborted) {
                    return;
                }

                count.state = state;
                count.controller = null;
                evict();
                notify();
            });
    };

    return {
        subscribe(listener: () => void) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        /** Counts the changes, for `useSyncExternalStore`. */
        version: () => version,

        /** An entry's properties as the adapter handed them over, or undefined until it has. */
        details: (entry: FileEntry) => details.get(entry),

        /**
         * Asks the adapter for an entry's properties once `ASK_AFTER` has passed, unless they've come
         * already. Returns the function to call once they're no longer wanted, which stops the
         * request if they haven't come yet.
         */
        wantDetails(entry: FileEntry, adapter: FileAdapter) {
            if (details.has(entry) || !adapter.properties) {
                return () => undefined;
            }

            const controller = new AbortController();
            const { signal } = controller;
            const timer = window.setTimeout(() => {
                Promise.resolve()
                    .then(() => adapter.properties?.(entry, { signal }) ?? {})
                    .then(
                        (value): Requested<EntryProperties> => ({ status: "ready", value }),
                        (error: unknown): Requested<EntryProperties> => ({ status: "error", error }),
                    )
                    .then((state) => {
                        if (!signal.aborted) {
                            details.set(entry, state);
                            notify();
                        }
                    });
            }, ASK_AFTER);

            return () => {
                window.clearTimeout(timer);
                controller.abort();
            };
        },

        /** Forgets an entry's properties, to ask for them again, e.g. after they failed. */
        forgetDetails(entry: FileEntry) {
            details.delete(entry);
            notify();
        },

        /**
         * What's in the folders, as counted for `changes`, or undefined until it's asked for. While
         * a count is on its way with nothing reported, the totals counted last for the same folders
         * stand in as its progress, so a change made elsewhere in the meantime doesn't blank them.
         */
        count(
            targets: readonly CountTarget[],
            changes: number,
            showHidden: boolean,
        ): Requested<EntryTotals> | undefined {
            const count = find(targets, changes, showHidden);

            if (count?.state.status !== "loading" || count.state.progress) {
                return count?.state;
            }

            const before = counts.findLast(
                (candidate) =>
                    candidate.state.status === "ready" &&
                    candidate.showHidden === showHidden &&
                    sameTargets(candidate.targets, targets),
            );

            return before?.state.status === "ready" ? { status: "loading", progress: before.state.value } : count.state;
        },

        /**
         * Asks for what's in the folders to be counted once `ASK_AFTER` has passed, unless it has been
         * for `changes`. Returns the function to call once it's no longer wanted, which stops the
         * count if nothing else wants it and it hasn't come yet.
         */
        wantCount(targets: readonly CountTarget[], changes: number, showHidden: boolean) {
            let count = find(targets, changes, showHidden);

            if (!count) {
                count = {
                    targets,
                    changes,
                    showHidden,
                    state: { status: "loading" },
                    users: 0,
                    timer: undefined,
                    controller: null,
                };
                counts.push(count);
            }

            const wanted = count;
            let released = false;

            wanted.users += 1;

            if (wanted.state.status === "loading" && !wanted.controller && wanted.timer === undefined) {
                wanted.timer = window.setTimeout(() => {
                    wanted.timer = undefined;
                    start(wanted);
                }, ASK_AFTER);
            }

            return () => {
                if (released) {
                    return;
                }

                released = true;
                wanted.users -= 1;

                if (wanted.users === 0 && wanted.state.status === "loading") {
                    window.clearTimeout(wanted.timer);
                    wanted.timer = undefined;
                    wanted.controller?.abort();
                    wanted.controller = null;
                    counts = counts.filter((candidate) => candidate !== wanted);
                }
            };
        },

        /** Forgets what was counted in the folders for `changes`, to count it again, e.g. after it failed. */
        forgetCount(targets: readonly CountTarget[], changes: number, showHidden: boolean) {
            const count = find(targets, changes, showHidden);

            counts = counts.filter((candidate) => candidate !== count);
            notify();
        },
    };
};

export type PropertiesCache = ReturnType<typeof createPropertiesCache>;
