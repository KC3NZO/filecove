import { useCallback, useEffect, useRef, useState } from "react";

import { previewKind, readText } from "../utils/preview";

import type { FileAdapter, FileEntry, PreviewContent } from "../types";

// The preview shows a spinner while a file loads, with no figure, so what an adapter reports is
// left unused.
const ignoreProgress = () => undefined;

/** A file being loaded, or loaded, for the preview. */
interface Slot {
    controller: AbortController;
    /** Made for a blob, and revoked as the slot goes. */
    objectUrl: string | null;
    /** A picture loaded ahead of being shown, held so the browser keeps it decoded until then. */
    image: HTMLImageElement | null;
}

interface PreviewContentsOptions {
    adapter: FileAdapter;
    entries: FileEntry[];
    /** The file shown, in `entries`. */
    index: number;
    /** Which way from it the file to load ahead lies, the way the last step went; null for none. */
    ahead: 1 | -1 | null;
    /**
     * Whether the browser is still loading the file shown from its URL, as it does a picture or a
     * video. The file ahead waits for it, so the two don't share the bandwidth.
     */
    pending: boolean;
}

// Forgets a file: stops loading it, and revokes its object URL.
const drop = (slot: Slot) => {
    slot.controller.abort();

    if (slot.image) {
        // Stops the download.
        slot.image.src = "";
    }

    if (slot.objectUrl) {
        URL.revokeObjectURL(slot.objectUrl);
    }
};

/**
 * Loads a file through the adapter's `content`, calling `done` with what came unless the slot was
 * dropped meanwhile. A picture loaded `ahead` of being shown is also fetched and decoded, so it
 * shows at once when stepped to.
 */
const load = (adapter: FileAdapter, entry: FileEntry, ahead: boolean, done: (content: PreviewContent) => void) => {
    const controller = new AbortController();
    const { signal } = controller;
    const slot: Slot = { controller, objectUrl: null, image: null };
    const kind = previewKind(entry);

    // Wrapped so an adapter that throws synchronously still ends up as a failure.
    Promise.resolve()
        .then(() => {
            if (!adapter.content) {
                throw new Error("Not supported here.");
            }

            return adapter.content(entry, { signal, purpose: "preview", onProgress: ignoreProgress });
        })
        .then(async (content): Promise<PreviewContent> => {
            signal.throwIfAborted();

            if (kind === "text") {
                const excerpt = await readText(content, signal);

                return excerpt ? { status: "text", excerpt } : { status: "binary" };
            }

            let url: string;

            if (content.url !== undefined) {
                url = content.url;
            } else {
                // A PDF is only ever shown as one, whatever type the blob says it is: a web page in
                // the frame would run in the page's own origin.
                url = URL.createObjectURL(
                    kind === "pdf" ? new Blob([content.blob], { type: "application/pdf" }) : content.blob,
                );
                slot.objectUrl = url;
            }

            if (ahead && kind === "image") {
                slot.image = new Image();
                slot.image.src = url;
                // One that fails fails again when it's shown, and says so then.
                slot.image.decode().catch(() => undefined);
            }

            return { status: "url", url };
        })
        .catch((error: unknown): PreviewContent => ({ status: "error", error }))
        .then((content) => {
            if (!signal.aborted) {
                done(content);
            }
        });

    return slot;
};

/**
 * What the preview has loaded to show `entries[index]`, through the adapter's `content`, and the
 * file one step further on, loaded ahead once the file shown has come, so stepping on shows it at
 * once. What was loaded is kept for the files one step either side of the one shown, so stepping
 * back is as quick, and dropped for the rest: their loads are aborted and their object URLs
 * revoked, so coming back to one loads it afresh. Files the preview can only describe aren't
 * fetched at all.
 */
export const usePreviewContents = ({ adapter, entries, index, ahead, pending }: PreviewContentsOptions) => {
    const slots = useRef(new Map<string, Slot>());
    const [contents, setContents] = useState<ReadonlyMap<string, PreviewContent>>(() => new Map());
    // Bumped by `retry`, which drops the file's slot, so it's loaded afresh.
    const [attempt, setAttempt] = useState(0);

    const entry = entries[index];
    const content = contents.get(entry.id) ?? null;
    const ready = previewKind(entry) === "none" || (content !== null && (content.status !== "url" || !pending));
    const aheadIndex = ready && ahead !== null ? index + ahead : null;

    useEffect(() => {
        const kept = new Set(entries.slice(Math.max(index - 1, 0), index + 2).map(({ id }) => id));

        for (const [id, slot] of slots.current) {
            if (!kept.has(id)) {
                drop(slot);
                slots.current.delete(id);
            }
        }

        setContents((prev) => {
            const next = new Map([...prev].filter(([id]) => kept.has(id)));

            return next.size === prev.size ? prev : next;
        });

        const wanted = aheadIndex === null ? [entries[index]] : [entries[index], entries[aheadIndex]];

        for (const file of wanted) {
            if (file && previewKind(file) !== "none" && !slots.current.has(file.id)) {
                const { id } = file;

                slots.current.set(
                    id,
                    load(adapter, file, file !== entries[index], (loaded) =>
                        setContents((prev) => new Map(prev).set(id, loaded)),
                    ),
                );
            }
        }
    }, [adapter, entries, index, aheadIndex, attempt]);

    // Everything goes with the preview.
    useEffect(() => {
        const current = slots.current;

        return () => {
            current.forEach(drop);
            current.clear();
            setContents(new Map());
        };
    }, []);

    /** Shows a file as failed, when the browser couldn't load what came for it, or can't show it. */
    const fail = useCallback((id: string, error: unknown) => {
        setContents((prev) => (prev.has(id) ? new Map(prev).set(id, { status: "error", error }) : prev));
    }, []);

    /** Loads a file afresh, in case a signed URL had run out. */
    const retry = useCallback((id: string) => {
        const slot = slots.current.get(id);

        if (slot) {
            drop(slot);
            slots.current.delete(id);
        }

        setContents((prev) => {
            const next = new Map(prev);

            next.delete(id);

            return next;
        });
        setAttempt((prev) => prev + 1);
    }, []);

    return { content, fail, retry };
};
