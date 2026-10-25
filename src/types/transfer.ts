// Internal to the package, not exported from the package entry.

import type { ConflictPolicy, FileAdapter, FileEntry } from "./adapter";
import type { FolderRef } from "./section";

export type TransferKind = "copy" | "move";

/**
 * Where a copy or move has got to: waiting for a free slot, being carried out by the adapter, or
 * failed. One that's done, or cancelled, leaves the queue.
 */
export type TransferStatus = "queued" | "running" | "failed";

/** A copy or move in the transfer queue. Replaced, never mutated, as it moves along. */
export interface TransferItem {
    /** Unique within its queue. */
    id: number;
    kind: TransferKind;
    /** Already known to support `kind`. */
    adapter: FileAdapter;
    /** Sharing a parent, as the adapter takes them. */
    entries: FileEntry[];
    /** The folder the entries are in. */
    source: FolderRef;
    /** The folder they go into. */
    target: FolderRef;
    /** Settles names the target already has, for every entry, as the user chose. */
    conflict: ConflictPolicy;
    status: TransferStatus;
    /** Whether the panel shows it: once it has taken a moment, or at once when it fails. */
    shown: boolean;
    /** How much the adapter has reported while carrying it out, in bytes, once it has reported any. */
    progress?: { loaded: number; total: number };
    /** Why it failed, as the adapter said, to show beside it. */
    error?: string;
}
