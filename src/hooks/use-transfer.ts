import { useEffect, useRef, useState } from "react";

import type { ConflictPolicy, FileAdapter, FileEntry, TransferOptions } from "../types";

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
 * Names of `entries`, or of files being uploaded, that a folder's listing already has, which a
 * transfer or upload into it would clash with.
 */
export const clashingNames = (entries: readonly { name: string }[], listing: FileEntry[] | undefined) => {
    const taken = new Set(listing?.map((entry) => entry.name));

    return entries.filter((entry) => taken.has(entry.name)).map((entry) => entry.name);
};

/**
 * Has the adapter copy or move entries, for the dialogs that do. `cancel` and unmounting abort the
 * call. The adapter can't undo a change it has made, so `refresh` runs however a run that reached
 * it ends, cancelled included; it should list the destination again, and the source after a move.
 */
export const useTransfer = (job: TransferJob, refresh: () => void) => {
    const [pending, setPending] = useState<ConflictPolicy | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => () => controller.current?.abort(), []);

    const run = (targetId: string, conflict: ConflictPolicy): Promise<TransferOutcome> => {
        const current = new AbortController();

        controller.current = current;
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
                    refresh();

                    return "done";
                },
                (error: unknown): TransferOutcome => {
                    if (current.signal.aborted) {
                        return "aborted";
                    }

                    controller.current = null;
                    refresh();
                    setPending(null);
                    setFailure(
                        error instanceof Error && error.message
                            ? error.message
                            : `Couldn't ${job.kind} ${job.entries.length === 1 ? "it" : "them"}.`,
                    );

                    return "failed";
                },
            );
    };

    const cancel = () => {
        if (controller.current) {
            controller.current.abort();
            controller.current = null;
            refresh();
        }
    };

    const clearFailure = () => setFailure(null);

    return { pending, failure, run, cancel, clearFailure };
};
