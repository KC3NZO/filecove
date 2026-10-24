import { useEffect, useRef, useState } from "react";

import { isolate } from "../utils/bidi";
import { useLocale } from "./use-locale";

import type { Clash, ConflictPolicy, FileAdapter, FileEntry, TransferOptions } from "../types";

/** A copy or move for the adapter to carry out. */
export interface TransferJob {
    kind: "copy" | "move";
    /** Already known to support `kind`. */
    adapter: FileAdapter;
    entries: FileEntry[];
}

/** How a run ended: done, failed with `failure` set, or aborted by `cancel` or unmounting. */
export type TransferOutcome = "done" | "failed" | "aborted";

const start = ({ kind, adapter, entries }: TransferJob, targetId: string, options: TransferOptions) => {
    if (kind === "copy" && adapter.copy) {
        return adapter.copy(entries, targetId, options);
    }

    if (kind === "move" && adapter.move) {
        return adapter.move(entries, targetId, options);
    }

    throw new Error("Not supported here.");
};

/**
 * The names of `entries`, or of files and folders being uploaded, that a folder's listing already
 * has, which a transfer or upload into it would clash with, with what has each there.
 */
export const findClashes = (
    entries: readonly Pick<FileEntry, "name" | "kind">[],
    listing: FileEntry[] | undefined,
): Clash[] => {
    const byName = new Map(listing?.map((entry): [string, FileEntry["kind"]] => [entry.name, entry.kind]));

    return entries.flatMap(({ name, kind }) => {
        const there = byName.get(name);

        return there ? [{ name, kind, there }] : [];
    });
};

/**
 * Ids of the folders in a folder's listing that a transfer of `entries` into it with "replace"
 * merged folders of their names into, so what's in them may have changed all the way down.
 */
export const mergedFolders = (entries: readonly FileEntry[], listing: FileEntry[] | undefined) => {
    const names = new Set(entries.filter((entry) => entry.kind === "folder").map((entry) => entry.name));

    return (listing ?? []).filter((entry) => entry.kind === "folder" && names.has(entry.name)).map((entry) => entry.id);
};

/**
 * Has the adapter copy or move entries, for the dialogs that do. `cancel` and unmounting abort the
 * call. The adapter can't undo a change it has made, so `refresh` runs however a run that reached
 * it ends, cancelled included, with the run's `conflict`; it should list the destination again, and
 * the source after a move, and after a "replace", the folders merged into (`mergedFolders`).
 */
export const useTransfer = (job: TransferJob, refresh: (conflict: ConflictPolicy) => void) => {
    const [pending, setPending] = useState<ConflictPolicy | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    // The running call's conflict policy, for `cancel`'s refresh.
    const running = useRef<ConflictPolicy>("keepBoth");
    const { text } = useLocale();

    useEffect(() => () => controller.current?.abort(), []);

    const run = (targetId: string, conflict: ConflictPolicy): Promise<TransferOutcome> => {
        const current = new AbortController();

        controller.current = current;
        running.current = conflict;
        setPending(conflict);
        setFailure(null);

        // Wrapped so an adapter that throws synchronously still ends up as a failure. A run aborted
        // before it reached the adapter, as React's development double mount does, never starts.
        return Promise.resolve()
            .then(() => {
                current.signal.throwIfAborted();

                return start(job, targetId, { signal: current.signal, conflict });
            })
            .then(
                (): TransferOutcome => {
                    if (current.signal.aborted) {
                        return "aborted";
                    }

                    controller.current = null;
                    refresh(conflict);

                    return "done";
                },
                (error: unknown): TransferOutcome => {
                    if (current.signal.aborted) {
                        return "aborted";
                    }

                    controller.current = null;
                    refresh(conflict);
                    setPending(null);
                    setFailure(
                        error instanceof Error && error.message
                            ? isolate(error.message)
                            : (job.kind === "move" ? text.moveFailed : text.copyFailed)(job.entries.length),
                    );

                    return "failed";
                },
            );
    };

    const cancel = () => {
        if (controller.current) {
            controller.current.abort();
            controller.current = null;
            refresh(running.current);
        }
    };

    const clearFailure = () => setFailure(null);

    return { pending, failure, run, cancel, clearFailure };
};
