// Internal to the package, not exported from the package entry.

import type { ConflictPolicy, FileAdapter, FileEntry } from "./adapter";
import type { FolderRef } from "./section";

export type TransferKind = "copy" | "move";

/**
 * Where a copy or move has got to: waiting for a free slot, being carried out by the adapter, or
 * failed. One that's done, or cancelled, leaves the queue.
 */
export type TransferStatus = "queued" | "running" | "failed";

/** An entry of a copy or move that has gone into the target, and what it is there when that's known. */
export interface WentEntry {
    entry: FileEntry;
    made?: FileEntry;
}

/** A copy or move in the transfer queue. Replaced, never mutated, as it moves along. */
export interface TransferItem {
    /** Unique within its queue. */
    id: number;
    kind: TransferKind;
    /** The adapter serving the entries, whose ids they are. */
    adapter: FileAdapter;
    /**
     * The adapter serving `target`: `adapter` itself, already known to support `kind`, or another,
     * which the queue copies the entries into itself, reading them through `adapter` (see
     * `transferAcross`).
     */
    targetAdapter: FileAdapter;
    /** Sharing a parent, as the adapter takes them. */
    entries: FileEntry[];
    /** The folder the entries are in. */
    source: FolderRef;
    /** The folder they go into. */
    target: FolderRef;
    /** Settles names the target already has, for every entry, as the user chose. */
    conflict: ConflictPolicy;
    /**
     * The transfer this one waits for, by id, while that one waits or runs: one before it bringing
     * entries of the same names into the same folder, which has to land first for `conflict` to
     * settle them.
     */
    after?: number;
    status: TransferStatus;
    /** Whether the panel shows it: once it has taken a moment, or at once when it fails. */
    shown: boolean;
    /** How much the adapter has reported while carrying it out, in bytes, once it has reported any. */
    progress?: { loaded: number; total: number };
    /**
     * The entries reported gone into the target so far (`TransferOptions.onEntryDone`), in the
     * order reported, which a failed or cancelled one keeps, as what went before it stopped.
     */
    went: WentEntry[];
    /** Why it failed, as the adapter said, to show beside it. */
    error?: string;
}

/**
 * What holds an entry: a move in the transfer queue, waiting or under way, or a move to the trash
 * or a restore from it, while the adapter works.
 */
export type MovingKind = "move" | "trash" | "restore";

/** Ids of the entries held through one adapter, each with what holds it. */
export type MovingKinds = ReadonlyMap<string, MovingKind>;

/**
 * Ids of the entries held, by moves in the transfer queue or by the trash's work, by the adapter
 * serving them, so every view marks them and nothing else is done to them meanwhile.
 */
export type MovingIds = ReadonlyMap<FileAdapter, MovingKinds>;
