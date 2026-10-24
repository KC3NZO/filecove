import { useEffect } from "react";

import { folderKey } from "../store/folder-store";
import { folderOf } from "../utils/navigation";

import type { Dispatch, SetStateAction } from "react";
import type { FolderStore } from "../store/folder-store";
import type { Clipboard, FileAdapter, FileEntry } from "../types";

/**
 * A folder's whole listing, listed through the store unless it's there, so it's shared with what
 * shows the folder, or listed again quietly when `fresh`, since one saved from before a change may
 * still hold entries it took away. A listing being checked again is waited for, as an entry may
 * only be found then. Rejected when listing fails or `signal` aborts.
 */
const listingOf = (
    store: FolderStore,
    sectionId: string,
    adapter: FileAdapter,
    folderId: string,
    fresh: boolean,
    signal: AbortSignal,
) =>
    new Promise<FileEntry[]>((resolve, reject) => {
        const key = folderKey(sectionId, folderId);

        if (signal.aborted) {
            reject(signal.reason);

            return;
        }

        const end = () => {
            unsubscribe();
            signal.removeEventListener("abort", abort);
        };

        const abort = () => {
            end();
            reject(signal.reason);
        };

        const check = () => {
            const state = store.get(key);

            if (state?.status === "ready" && !state.checking) {
                end();
                resolve(state.entries ?? []);
            } else if (state?.status === "error") {
                end();
                reject(state.error);
            } else if (!state) {
                // Not listed yet, or dropped meanwhile, as after another change.
                store.load(key, adapter, folderId);
            }
        };

        const unsubscribe = store.subscribe(check);

        signal.addEventListener("abort", abort);

        // As old as it may be, the listing is listed again, unless a request is in flight.
        if (fresh) {
            store.open(key, adapter, folderId, 0);
        }

        check();
    });

// The clipboard with its entries as they are now: by name, the folders from the first step not
// known, under the renamed folder's new id, and then the entries, a listing at a time; by id, the
// entries still in their folder. Null when a folder on the way is gone, or none of the entries is
// there.
const lookUp = async (clipboard: Clipboard, store: FolderStore, signal: AbortSignal): Promise<Clipboard | null> => {
    const { kind, section, adapter, lookup } = clipboard;
    const list = (folderId: string, fresh: boolean) => listingOf(store, section.id, adapter, folderId, fresh, signal);

    if (lookup?.by !== "name") {
        const listed = await list(folderOf(section, clipboard.trail).id, true);
        const byId = new Map(listed.map((entry) => [entry.id, entry] as const));
        const entries = clipboard.entries.flatMap((entry) => byId.get(entry.id) ?? []);

        return entries.length > 0 ? { kind, section, adapter, trail: clipboard.trail, entries } : null;
    }

    // The renamed folder's listings went with its old id, so what's listed below it is new.
    const trail = clipboard.trail.slice(0, lookup.from);

    for (const step of clipboard.trail.slice(lookup.from)) {
        const listed = await list(folderOf(section, trail).id, false);
        const folder = listed.find((entry) => entry.kind === "folder" && entry.name === step.name);

        if (!folder) {
            return null;
        }

        trail.push({ id: folder.id, name: folder.name });
    }

    // A file and a folder may share a name, so each is found by both. Names never hold "/".
    const listed = await list(folderOf(section, trail).id, false);
    const byName = new Map(listed.map((entry) => [`${entry.kind}/${entry.name}`, entry] as const));
    const entries = clipboard.entries.flatMap((entry) => byName.get(`${entry.kind}/${entry.name}`) ?? []);

    return entries.length > 0 ? { kind, section, adapter, trail, entries } : null;
};

/**
 * Looks for the clipboard's entries again while it has a `lookup`, after a change that may have
 * left their ids naming nothing, or others: by the names a rename leaves as they were, after a
 * folder above them was renamed to a new id, or by id in their folder listed again, after a change
 * where names can't be trusted. The clipboard takes the entries as they are now, or empties when
 * none is found. A clipboard changed meanwhile, by another cut, copy or change, stops it.
 */
export const useClipboardFollow = (
    clipboard: Clipboard | null,
    setClipboard: Dispatch<SetStateAction<Clipboard | null>>,
    store: FolderStore,
) => {
    useEffect(() => {
        if (!clipboard?.lookup) {
            return;
        }

        const controller = new AbortController();
        const settle = (found: Clipboard | null) => setClipboard((prev) => (prev === clipboard ? found : prev));

        lookUp(clipboard, store, controller.signal).then(settle, () => {
            if (!controller.signal.aborted) {
                settle(null);
            }
        });

        return () => controller.abort();
    }, [clipboard, setClipboard, store]);
};
