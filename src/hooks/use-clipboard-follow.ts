import { useEffect } from "react";

import { listingOf } from "../store/folder-store";
import { folderOf } from "../utils/navigation";

import type { Dispatch, SetStateAction } from "react";
import type { FolderStore } from "../store/folder-store";
import type { Clipboard, ClipboardPart } from "../types";

// A part of the clipboard with its entries as they are now: by name, the folders from the first
// step not known, under the renamed folder's new id, and then the entries, a listing at a time; by
// id, the entries still in their folder. Null when a folder on the way is gone, or none of the
// entries is there.
const lookUp = async (
    { adapter }: Clipboard,
    part: ClipboardPart,
    store: FolderStore,
    signal: AbortSignal,
): Promise<ClipboardPart | null> => {
    const { section, lookup } = part;
    const list = (folderId: string, fresh: boolean) => listingOf(store, section.id, adapter, folderId, fresh, signal);

    if (lookup?.by !== "name") {
        const listed = await list(folderOf(section, part.trail).id, true);
        const byId = new Map(listed.map((entry) => [entry.id, entry] as const));
        const entries = part.entries.flatMap((entry) => byId.get(entry.id) ?? []);

        return entries.length > 0 ? { section, trail: part.trail, entries } : null;
    }

    // The renamed folder's listings went with its old id, so what's listed below it is new.
    const trail = part.trail.slice(0, lookup.from);

    for (const step of part.trail.slice(lookup.from)) {
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
    const entries = part.entries.flatMap((entry) => byName.get(`${entry.kind}/${entry.name}`) ?? []);

    return entries.length > 0 ? { section, trail, entries } : null;
};

/**
 * Looks for the clipboard's entries again while a part of it has a `lookup`, after a change that
 * may have left their ids naming nothing, or others: by the names a rename leaves as they were,
 * after a folder above them was renamed to a new id, or by id in their folder listed again, after
 * a change where names can't be trusted. Each such part takes the entries as they are now, or goes
 * when none is found or its folder can't be listed, and the clipboard empties once no part is
 * left. A clipboard changed meanwhile, by another cut, copy or change, stops it.
 */
export const useClipboardFollow = (
    clipboard: Clipboard | null,
    setClipboard: Dispatch<SetStateAction<Clipboard | null>>,
    store: FolderStore,
) => {
    useEffect(() => {
        if (!clipboard?.parts.some((part) => part.lookup)) {
            return;
        }

        const controller = new AbortController();
        const found = clipboard.parts.map((part) =>
            part.lookup ? lookUp(clipboard, part, store, controller.signal).catch(() => null) : part,
        );

        Promise.all(found).then((parts) => {
            if (controller.signal.aborted) {
                return;
            }

            const kept = parts.filter((part) => part !== null);

            setClipboard((prev) => (prev === clipboard ? (kept.length > 0 ? { ...clipboard, parts: kept } : null) : prev));
        });

        return () => controller.abort();
    }, [clipboard, setClipboard, store]);
};
