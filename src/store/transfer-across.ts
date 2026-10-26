import { isolate } from "../utils/bidi";
import { freeName } from "../utils/names";
import { allows } from "../utils/permissions";
import { listAll } from "./upload-queue";

import type { ConflictPolicy, FileAdapter, FileEntry, TransferKind, TransferOptions, TransferResult } from "../types";

/** What a copy between adapters words itself, as the host's text has it. */
export interface AcrossText {
    /** A folder made beside one of its name, as `UploadLocaleText`'s words it. */
    keptBothName: (name: string, number: number) => string;
    /** Why a file handed over as a URL couldn't be fetched, its server answering with an error. */
    serverError: (status: number, statusText: string) => string;
}

/** How many folders are listed at once while finding what a copy between adapters carries. */
const LISTED_AT_ONCE = 4;

/** An entry carried, a folder with everything in it, as listed through the adapter it's copied from. */
interface Carried {
    entry: FileEntry;
    /** Folders: what's in them, once listed. */
    children?: Carried[];
}

const isFolder = (item: Carried) => item.entry.kind === "folder";

/**
 * The entries with everything in folders among them, listed through `from`, every page,
 * `LISTED_AT_ONCE` folders at a time, and how many bytes their files come to, so what goes is known
 * before anything is sent, and a folder that can't be listed stops it before anything is.
 */
const gather = async (from: FileAdapter, entries: FileEntry[], signal: AbortSignal) => {
    const roots = entries.map((entry): Carried => ({ entry }));
    // A listing failing calls off the rest.
    const controller = new AbortController();
    const stop = () => controller.abort(signal.reason);
    const waiting: (() => void)[] = [];
    let listing = 0;
    let size = 0;

    // A folder waits for a free slot, which one ending hands straight on.
    const visit = async (item: Carried): Promise<void> => {
        if (!isFolder(item)) {
            size += item.entry.size ?? 0;

            return;
        }

        if (listing < LISTED_AT_ONCE) {
            listing += 1;
        } else {
            await new Promise<void>((resolve) => waiting.push(resolve));
        }

        try {
            // One that waited while another failed isn't listed.
            controller.signal.throwIfAborted();

            const { holds } = await listAll(from, item.entry.id, controller.signal);

            item.children = [...holds.values()].map((entry): Carried => ({ entry }));
        } finally {
            const next = waiting.shift();

            if (next) {
                next();
            } else {
                listing -= 1;
            }
        }

        await Promise.all((item.children ?? []).map(visit));
    };

    signal.addEventListener("abort", stop, { once: true });

    try {
        await Promise.all(roots.map(visit));
    } catch (error) {
        controller.abort();
        throw error;
    } finally {
        signal.removeEventListener("abort", stop);
    }

    return { roots, size };
};

/**
 * Refuses a name the backend's own rules don't take (the adapter's `checkName`), with its message,
 * before anything is sent.
 */
const checkName = (adapter: FileAdapter, name: string, kind: FileEntry["kind"], parentId: string) => {
    const refused = adapter.checkName?.(name, { kind, parentId });

    if (refused) {
        throw new Error(refused);
    }
};

const share = (loaded: number, total: number) => Math.min(Math.max(loaded / total, 0), 1);

/**
 * Copies, or moves, `entries`, which `from` serves and share a folder, into `targetId`, a folder
 * another adapter, `to`, serves, as neither knows the other: everything in folders is listed first
 * through `from`'s `list`, then each file is read through `from`'s `content` and handed to `to`'s
 * `upload`, one after another, and each folder made with `to`'s `createFolder`, as a folder upload
 * goes. Names the target has are settled by `conflict` as `ConflictPolicy` says, as an adapter's
 * own `copy` would: a folder merged into a folder of its name that can change, all the way down, a
 * file and a folder, or what can't be written, kept both, a folder under a free name
 * (`keptBothName`), as `createFolder` can't keep both, and the adapter's `checkName` asked before
 * each name is sent. A move deletes each entry through `from`'s `delete` once all of it is there.
 *
 * Each entry is reported as it's done (`onEntryDone`), so one failing partway says what went before
 * it, and the bytes read and sent of all the files (`onProgress`), half each. Resolves with what
 * each entry became, when `to`'s `upload` said of every file, as an adapter's `copy` resolves.
 */
export const transferAcross = async (
    kind: TransferKind,
    from: FileAdapter,
    to: FileAdapter,
    entries: FileEntry[],
    targetId: string,
    { signal, conflict, onProgress, onEntryDone }: TransferOptions,
    text: AcrossText,
): Promise<TransferResult | void> => {
    if (!from.content || !to.upload || (kind === "move" && !from.delete)) {
        throw new Error("Not supported here.");
    }

    const read = from.content.bind(from);
    const upload = to.upload.bind(to);
    const createFolder = to.createFolder?.bind(to);
    const remove = from.delete?.bind(from);
    const { roots, size } = await gather(from, entries, signal);
    const { holds } = await listAll(to, targetId, signal);
    // The bytes of the files done, so far.
    let done = 0;

    const report = (current: number) => {
        if (size > 0) {
            onProgress(Math.min(done + current, size), size);
        }
    };

    // Read, then sent, each half of how far the file has got. A URL is fetched by the page.
    const send = async (entry: FileEntry, parentId: string, settle: ConflictPolicy) => {
        const bytes = entry.size ?? 0;
        let got = 0;
        let sent = 0;
        const step = () => report((bytes * (got + sent)) / 2);

        checkName(to, entry.name, "file", parentId);

        const content = await read(entry, {
            signal,
            purpose: "copy",
            onProgress: (loaded, total) => {
                if (total > 0) {
                    got = share(loaded, total);
                    step();
                }
            },
        });
        let blob: Blob;

        if (content.url === undefined) {
            blob = content.blob;
        } else {
            const response = await fetch(content.url, { signal });

            if (!response.ok) {
                throw new Error(
                    text.serverError(response.status, response.statusText && isolate(response.statusText)),
                );
            }

            blob = await response.blob();
        }

        got = 1;
        step();

        const file = new File([blob], entry.name, {
            type: entry.mimeType ?? blob.type,
            lastModified: entry.modifiedAt?.getTime(),
        });
        const made = await upload(file, parentId, {
            signal,
            conflict: settle,
            onProgress: (loaded, total) => {
                if (total > 0) {
                    sent = share(loaded, total);
                    step();
                }
            },
        });

        done += bytes;
        report(0);

        return made || undefined;
    };

    // Puts an entry into `parentId`, whose entries by name are `there`, settling its name by
    // `settle`, and says what it became there, or null when it's skipped. `taken` are the names
    // there and going in beside it, which a folder made under a free name stays clear of.
    const put = async (
        item: Carried,
        parentId: string,
        there: ReadonlyMap<string, FileEntry>,
        taken: Set<string>,
        settle: ConflictPolicy,
    ): Promise<{ made?: FileEntry } | null> => {
        const { entry } = item;
        const clash = there.get(entry.name);
        const replacing = settle === "replace" && allows("write", clash?.permissions);

        if (clash && settle === "skip") {
            return null;
        }

        // A file never takes a folder's place, nor that of a file that can't be written.
        if (!isFolder(item)) {
            const replaces = replacing && clash?.kind === "file";

            return { made: await send(entry, parentId, replaces ? "replace" : "keepBoth") };
        }

        // A folder is merged into a folder of its name, unless its own listing says it can't change.
        if (replacing && clash?.kind === "folder") {
            const inside = await listAll(to, clash.id, signal);

            if (allows("write", inside.permissions)) {
                await fill(item, clash.id, inside.holds, "replace");

                return { made: clash };
            }
        }

        if (!createFolder) {
            throw new Error("Not supported here.");
        }

        const name = clash ? freeName(entry.name, taken, text) : entry.name;

        taken.add(name);
        checkName(to, name, "folder", parentId);

        const made = await createFolder(parentId, name, { signal });

        await fill(item, made.id, new Map(), "keepBoth");

        return { made };
    };

    // What's in a folder goes into the one it became, its folders first, as a folder upload's do.
    // A folder just made has nothing to clash with.
    const fill = async (
        item: Carried,
        folderId: string,
        there: ReadonlyMap<string, FileEntry>,
        settle: ConflictPolicy,
    ) => {
        const children = item.children ?? [];
        const taken = new Set([...there.keys(), ...children.map((child) => child.entry.name)]);

        for (const child of [...children.filter(isFolder), ...children.filter((child) => !isFolder(child))]) {
            await put(child, folderId, there, taken, settle);
        }
    };

    const taken = new Set([...holds.keys(), ...entries.map((entry) => entry.name)]);
    const made: FileEntry[] = [];
    let told = true;

    // In the order given, each done before the next starts, and gone from `from` once all of it is
    // there, for a move.
    for (const item of roots) {
        const went = await put(item, targetId, holds, taken, conflict);

        if (!went) {
            continue;
        }

        if (kind === "move" && remove) {
            await remove([item.entry], { signal });
        }

        onEntryDone(item.entry, went.made);

        if (went.made) {
            made.push(went.made);
        } else {
            told = false;
        }
    }

    return told ? { entries: made } : undefined;
};
