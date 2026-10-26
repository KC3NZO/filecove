import type {
    CountTarget,
    EntryProperties,
    EntryTotals,
    FileAdapter,
    FileEntry,
    PropertyField,
    PropertySave,
    Requested,
} from "../types";

/**
 * How long something stays shown before the adapter is asked about it, in ms, so moving through a
 * list with the arrow keys asks only about where it stops.
 */
const ASK_AFTER = 200;

/**
 * How long something asked about before waits after a change to be asked about again, in ms, and
 * waits anew with each further change, so changes coming one after another ask once they've
 * stopped. Longer than the upload queue's `REPORT_INTERVAL` (1 s), so uploads finishing one after
 * another count a folder again once, after the last.
 */
const SETTLE_AFTER = 1500;

/** How often, at most, totals counted so far are told to the listeners, in ms. */
const PROGRESS_INTERVAL = 150;

/** How many counts are kept once nothing shows them, the ones asked for longest ago going first. */
const MAX_KEPT_COUNTS = 30;

/** How many entries' latest properties are kept per adapter, the ones come longest ago going first. */
const MAX_STAND_INS = 100;

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
    /** Waiting out `ASK_AFTER` or `SETTLE_AFTER`. */
    timer: number | undefined;
    /** Set while it's counting. */
    controller: AbortController | null;
}

// The same folders. Ids are unique within an adapter, so a folder listed anew with a new entry
// object, as for its item count after a change, is still the same folder.
const sameTargets = (a: readonly CountTarget[], b: readonly CountTarget[]) =>
    a.length === b.length &&
    a.every((target, index) => target.entry.id === b[index].entry.id && target.adapter === b[index].adapter);

const sameFolders = (a: Count, b: Count) => a.showHidden === b.showHidden && sameTargets(a.targets, b.targets);

/** A field's edit, kept by the entry's id and the field's, so it outlives the entry being listed anew. */
const saveKey = (entry: FileEntry, fieldId: string) => JSON.stringify([entry.id, fieldId]);

/** A field with the value saved, when the value is of its type. */
const withSaved = (field: PropertyField, value: string | readonly string[]): PropertyField => {
    if (field.type === "text" && typeof value === "string") {
        return { ...field, value };
    }

    return field.type === "tags" && typeof value !== "string" ? { ...field, value } : field;
};

/** The properties with a field's value as it was saved, for an adapter resolving with nothing. */
const withValue = (properties: EntryProperties, fieldId: string, value: string | readonly string[]) => ({
    ...properties,
    groups: properties.groups?.map((group) => ({
        ...group,
        fields: group.fields.map((field) => (field.id === fieldId ? withSaved(field, value) : field)),
    })),
});

/**
 * What adapters handed over for the properties panel: an entry's properties (`properties`), kept by
 * the entry object, which a listing keeps for as long as the entry is as it was, and what's in
 * folders (`measure`), kept by the folders' ids and adapters, whether hidden files show, and the
 * host's count of its changes, so a change counts them again. Each is asked for once it has been
 * wanted for `ASK_AFTER`, or after a change, `SETTLE_AFTER`, and stopped if it stops being wanted
 * before it has come. Meanwhile, what came before for the same entry or folders stands in. It
 * imports nothing from the file manager, so the media manager can use it too.
 */
export const createPropertiesCache = () => {
    const details = new WeakMap<FileEntry, Requested<EntryProperties>>();
    // The latest properties that came for each entry, by adapter and id, to stand in while an entry
    // listed anew as it changed is asked about again.
    const latest = new WeakMap<FileAdapter, Map<string, EntryProperties>>();
    // Edits being saved, or that failed, by adapter, then entry and field, so they outlive the panel
    // moving on to something else, and show again as it comes back.
    const saves = new WeakMap<FileAdapter, Map<string, PropertySave>>();
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

    const standInOf = (entry: FileEntry, adapter: FileAdapter) => latest.get(adapter)?.get(entry.id);

    const keepLatest = (entry: FileEntry, adapter: FileAdapter, value: EntryProperties) => {
        let kept = latest.get(adapter);

        if (!kept) {
            kept = new Map();
            latest.set(adapter, kept);
        }

        kept.delete(entry.id);
        kept.set(entry.id, value);

        if (kept.size > MAX_STAND_INS) {
            kept.delete(kept.keys().next().value ?? "");
        }
    };

    const find = (targets: readonly CountTarget[], changes: number, showHidden: boolean) =>
        counts.find(
            (count) =>
                count.changes === changes && count.showHidden === showHidden && sameTargets(count.targets, targets),
        );

    // What stands in for a count not done yet, or not asked for yet: the latest done of the same
    // folders' other counts, or else one counting them with totals so far.
    const standInFor = (targets: readonly CountTarget[], showHidden: boolean, count?: Count) => {
        const others = counts.filter(
            (other) => other !== count && other.showHidden === showHidden && sameTargets(other.targets, targets),
        );

        return (
            others.findLast((other) => other.state.status === "ready") ??
            others.findLast((other) => other.state.status === "loading" && !!other.state.progress)
        );
    };

    const stop = (count: Count) => {
        window.clearTimeout(count.timer);
        count.timer = undefined;
        count.controller?.abort();
        count.controller = null;
    };

    // Drops the counts nothing wants that haven't come: those waiting, and those counting, unless a
    // later count of the same folders that's wanted is still waiting, which they stand in for.
    const prune = () => {
        counts = counts.filter((count, index) => {
            if (count.users > 0 || count.state.status !== "loading") {
                return true;
            }

            const standsIn =
                !!count.controller &&
                counts.some(
                    (later, laterIndex) =>
                        laterIndex > index &&
                        later.users > 0 &&
                        later.state.status === "loading" &&
                        !later.controller &&
                        sameFolders(later, count),
                );

            if (!standsIn) {
                stop(count);
            }

            return standsIn;
        });
    };

    // Forgets the counts nothing shows beyond `MAX_KEPT_COUNTS`, those asked for longest ago first.
    const evict = () => {
        let excess = counts.length - MAX_KEPT_COUNTS;

        counts = counts.filter((count) => {
            if (excess > 0 && count.users === 0 && count.state.status !== "loading") {
                excess -= 1;

                return false;
            }

            return true;
        });
    };

    // Each adapter counts its own folders, and their totals are added up, as are the totals each
    // reports on the way. Those counting the same folders for an earlier change, standing in until
    // now, are stopped.
    const start = (count: Count) => {
        const controller = new AbortController();
        const { signal } = controller;
        const groups = new Map<FileAdapter, FileEntry[]>();

        count.controller = controller;
        prune();
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

        /**
         * An entry's properties as the adapter handed them over, or undefined until it has. While an
         * entry listed anew as it changed waits to be asked about again, what came for it before,
         * by its id, stands in as the progress of its loading.
         */
        details(entry: FileEntry, adapter: FileAdapter): Requested<EntryProperties> | undefined {
            const state = details.get(entry);
            const before = state ? undefined : standInOf(entry, adapter);

            return before ? { status: "loading", progress: before } : state;
        },

        /**
         * Asks the adapter for an entry's properties once `ASK_AFTER` has passed, or `SETTLE_AFTER`
         * for an entry asked about before by its id, which has changed, unless they've come already.
         * Returns the function to call once they're no longer wanted, which stops the request if they
         * haven't come yet.
         */
        wantDetails(entry: FileEntry, adapter: FileAdapter) {
            if (details.has(entry) || !adapter.properties) {
                return () => undefined;
            }

            const controller = new AbortController();
            const { signal } = controller;
            const timer = window.setTimeout(
                () => {
                    Promise.resolve()
                        .then(() => adapter.properties?.(entry, { signal }) ?? {})
                        .then(
                            (value): Requested<EntryProperties> => ({ status: "ready", value }),
                            (error: unknown): Requested<EntryProperties> => ({ status: "error", error }),
                        )
                        .then((state) => {
                            // An edit saved meanwhile has set them, as they are after it.
                            if (signal.aborted || details.has(entry)) {
                                return;
                            }

                            details.set(entry, state);

                            if (state.status === "ready") {
                                keepLatest(entry, adapter, state.value);
                            }

                            notify();
                        });
                },
                standInOf(entry, adapter) ? SETTLE_AFTER : ASK_AFTER,
            );

            return () => {
                window.clearTimeout(timer);
                controller.abort();
            };
        },

        /**
         * Forgets an entry's properties, and what stands in for them, to ask again at once, e.g.
         * after they failed.
         */
        forgetDetails(entry: FileEntry, adapter: FileAdapter) {
            details.delete(entry);
            latest.get(adapter)?.delete(entry.id);
            notify();
        },

        /** A field's edit being saved, or that failed, or undefined when there's none. */
        save(entry: FileEntry, adapter: FileAdapter, fieldId: string): PropertySave | undefined {
            return saves.get(adapter)?.get(saveKey(entry, fieldId));
        },

        /**
         * Saves a field's new value through the adapter's `updateProperties`, kept meanwhile and,
         * should it fail, until it's saved or dropped, wherever the panel has gone. What the adapter
         * resolves with shows as the entry's properties, or else what was shown with the value saved.
         * Resolves with whether it was saved.
         */
        saveProperty(
            entry: FileEntry,
            adapter: FileAdapter,
            fieldId: string,
            value: string | readonly string[],
            onSaved?: () => void,
        ): Promise<boolean> {
            let kept = saves.get(adapter);

            if (!kept) {
                kept = new Map();
                saves.set(adapter, kept);
            }

            const held = kept;
            const key = saveKey(entry, fieldId);
            const save: PropertySave = { status: "saving", value };

            held.set(key, save);
            notify();

            // Wrapped so an adapter that throws synchronously still fails the save. Nothing calls it
            // off once it's sent, as the change may have been made by then.
            return Promise.resolve()
                .then(() => {
                    if (!adapter.updateProperties) {
                        throw new Error("The adapter has no `updateProperties`.");
                    }

                    return adapter.updateProperties(entry, { [fieldId]: value }, { signal: new AbortController().signal });
                })
                .then(
                    (saved) => {
                        if (held.get(key) !== save) {
                            return false;
                        }

                        const before = details.get(entry);
                        const shown = before?.status === "ready" ? before.value : standInOf(entry, adapter);
                        const now = saved ?? (shown ? withValue(shown, fieldId, value) : undefined);

                        held.delete(key);

                        if (now) {
                            details.set(entry, { status: "ready", value: now });
                            keepLatest(entry, adapter, now);
                        }

                        notify();
                        onSaved?.();

                        return true;
                    },
                    (error: unknown) => {
                        if (held.get(key) === save) {
                            held.set(key, { status: "error", value, error });
                            notify();
                        }

                        return false;
                    },
                );
        },

        /** Forgets a field's edit that failed, as the user leaves the field as it was. */
        dropSave(entry: FileEntry, adapter: FileAdapter, fieldId: string) {
            const kept = saves.get(adapter);
            const key = saveKey(entry, fieldId);

            if (kept?.get(key)?.status === "error") {
                kept.delete(key);
                notify();
            }
        },

        /**
         * What's in the folders, as counted for `changes`, or undefined until it's asked for. Until
         * the count for a change has started, the totals counted last for the same folders show as
         * they are; while it counts with nothing reported yet, as its progress. So changes made
         * meanwhile don't blank them.
         */
        count(
            targets: readonly CountTarget[],
            changes: number,
            showHidden: boolean,
        ): Requested<EntryTotals> | undefined {
            const count = find(targets, changes, showHidden);

            if (count && (count.state.status !== "loading" || count.state.progress)) {
                return count.state;
            }

            const standIn = standInFor(targets, showHidden, count);

            if (!standIn || !count?.controller) {
                return standIn?.state ?? count?.state;
            }

            return standIn.state.status === "ready"
                ? { status: "loading", progress: standIn.state.value }
                : standIn.state;
        },

        /**
         * Asks for what's in the folders to be counted for `changes` once `ASK_AFTER` has passed, or
         * `SETTLE_AFTER` when they were counted for an earlier change, unless they have been already.
         * Returns the function to call once it's no longer wanted, which stops the count, unless
         * something wants it, or it stands in for a later count, once the commit is over, so a count
         * wanted again straight away carries on.
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
                wanted.timer = window.setTimeout(
                    () => {
                        wanted.timer = undefined;
                        start(wanted);
                        // Counting, what stands in for it shows as its progress.
                        notify();
                    },
                    standInFor(targets, showHidden, wanted) ? SETTLE_AFTER : ASK_AFTER,
                );
            }

            return () => {
                if (released) {
                    return;
                }

                released = true;
                wanted.users -= 1;
                queueMicrotask(prune);
            };
        },

        /**
         * Forgets what was counted in the folders, for every change, to count them again at once,
         * e.g. after it failed.
         */
        forgetCount(targets: readonly CountTarget[], showHidden: boolean) {
            counts = counts.filter((count) => {
                const forgotten = count.showHidden === showHidden && sameTargets(count.targets, targets);

                if (forgotten) {
                    stop(count);
                }

                return !forgotten;
            });
            notify();
        },
    };
};

export type PropertiesCache = ReturnType<typeof createPropertiesCache>;
