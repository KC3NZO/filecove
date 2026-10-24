import { useCallback, useEffect, useRef, useState } from "react";

import { previewKey, readText } from "../utils/preview";

import type { FileAdapter, FileContent, FileEntry, PreviewContent, PreviewPlan } from "../types";

// The preview shows a spinner while a file loads, with no figure, so what an adapter reports is
// left unused.
const ignoreProgress = () => undefined;

/** Counts the fonts loaded, each added to the page's fonts under a family name of its own. */
let fontsLoaded = 0;

/** A file being loaded, or loaded, for the preview. */
interface Slot {
    controller: AbortController;
    /** Made for a blob, and revoked as the slot goes. */
    objectUrl: string | null;
    /** A picture loaded ahead of being shown, held so the browser keeps it decoded until then. */
    image: HTMLImageElement | null;
    /** A font, in the page's fonts while the slot is kept. */
    face: FontFace | null;
    /** What the adapter handed over, kept for reading more of a text file. */
    content: FileContent | null;
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
    /** How a file is shown, and so what's loaded for it. */
    planOf: (entry: FileEntry) => PreviewPlan;
}

// Forgets a file: stops loading it, revokes its object URL, and takes its font off the page.
const drop = (slot: Slot) => {
    slot.controller.abort();

    if (slot.image) {
        // Stops the download.
        slot.image.src = "";
    }

    if (slot.objectUrl) {
        URL.revokeObjectURL(slot.objectUrl);
    }

    if (slot.face) {
        document.fonts.delete(slot.face);
    }
};

/** Loads a font from what the adapter handed over, its bytes or its URL, which needs CORS on another origin. */
const loadFont = async (content: FileContent, slot: Slot, signal: AbortSignal): Promise<PreviewContent> => {
    fontsLoaded += 1;

    const family = `file-manager-preview-${fontsLoaded}`;
    const source =
        content.url === undefined ? await content.blob.arrayBuffer() : `url(${JSON.stringify(content.url)})`;
    const face = new FontFace(family, source);

    await face.load();
    signal.throwIfAborted();
    document.fonts.add(face);
    slot.face = face;

    return { status: "font", family };
};

/**
 * Loads a file through the adapter's `content`, calling `done` with what came unless the slot was
 * dropped meanwhile. A picture loaded `ahead` of being shown is also fetched and decoded, so it
 * shows at once when stepped to.
 */
const load = (
    adapter: FileAdapter,
    entry: FileEntry,
    plan: PreviewPlan,
    ahead: boolean,
    done: (content: PreviewContent) => void,
) => {
    const controller = new AbortController();
    const { signal } = controller;
    const slot: Slot = { controller, objectUrl: null, image: null, face: null, content: null };

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
            slot.content = content;

            if (plan.reads === "text") {
                const excerpt = await readText(content, signal);

                return excerpt ? { status: "text", excerpt } : { status: "binary" };
            }

            if (plan.reads === "font") {
                return loadFont(content, slot, signal);
            }

            let url: string;

            if (content.url !== undefined) {
                url = content.url;
            } else {
                // A PDF is only ever shown as one, whatever type the blob says it is: a web page in
                // the frame would run in the page's own origin.
                url = URL.createObjectURL(
                    plan.kind === "pdf" ? new Blob([content.blob], { type: "application/pdf" }) : content.blob,
                );
                slot.objectUrl = url;
            }

            if (ahead && plan.kind === "image") {
                slot.image = new Image();
                slot.image.src = url;
                // One that fails fails again when it's shown, and says so then.
                slot.image.decode().catch(() => undefined);
            }

            return content.blob ? { status: "url", url, blob: content.blob } : { status: "url", url };
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
 * back is as quick, and dropped for the rest: their loads are aborted, their object URLs revoked
 * and their fonts taken off the page, so coming back to one loads it afresh. Files the preview can
 * only describe, and those a previewer of the app's own shows without loading, aren't fetched.
 */
export const usePreviewContents = ({ adapter, entries, index, ahead, pending, planOf }: PreviewContentsOptions) => {
    const slots = useRef(new Map<string, Slot>());
    const [contents, setContents] = useState<ReadonlyMap<string, PreviewContent>>(() => new Map());
    // Bumped by `retry`, which drops the file's slot, so it's loaded afresh, and keys what shows it.
    const [attempt, setAttempt] = useState(0);
    // The files kept, the one shown and those either side, which may fail or be read further.
    const kept = useRef<ReadonlySet<string>>(new Set());

    const entry = entries[index];
    const content = contents.get(previewKey(entry)) ?? null;
    const ready = planOf(entry).reads === "none" || (content !== null && (content.status !== "url" || !pending));
    const aheadIndex = ready && ahead !== null ? index + ahead : null;

    useEffect(() => {
        const keep = new Set(entries.slice(Math.max(index - 1, 0), index + 2).map(previewKey));

        kept.current = keep;

        for (const [id, slot] of slots.current) {
            if (!keep.has(id)) {
                drop(slot);
                slots.current.delete(id);
            }
        }

        setContents((prev) => {
            const next = new Map([...prev].filter(([id]) => keep.has(id)));

            return next.size === prev.size ? prev : next;
        });

        const wanted = aheadIndex === null ? [entries[index]] : [entries[index], entries[aheadIndex]];

        for (const file of wanted) {
            const plan = file && planOf(file);
            const key = file && previewKey(file);

            if (file && key && plan && plan.reads !== "none" && !slots.current.has(key)) {
                slots.current.set(
                    key,
                    load(adapter, file, plan, file !== entries[index], (loaded) =>
                        setContents((prev) => new Map(prev).set(key, loaded)),
                    ),
                );
            }
        }
    }, [adapter, entries, index, aheadIndex, attempt, planOf]);

    // Everything goes with the preview.
    useEffect(() => {
        const current = slots.current;

        return () => {
            current.forEach(drop);
            current.clear();
            setContents(new Map());
        };
    }, []);

    /**
     * Shows a file as failed, when the browser couldn't load what came for it or can't show it, or
     * a previewer of the app's own couldn't, which may have loaded nothing.
     */
    const fail = useCallback((failed: FileEntry, error: unknown) => {
        const id = previewKey(failed);

        setContents((prev) =>
            prev.has(id) || kept.current.has(id) ? new Map(prev).set(id, { status: "error", error }) : prev,
        );
    }, []);

    /** Loads a file afresh, in case a signed URL had run out. */
    const retry = useCallback((again: FileEntry) => {
        const id = previewKey(again);
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

    /** Reads a text file further, up to `limit` bytes, showing what was read meanwhile. */
    const more = useCallback((read: FileEntry, limit: number) => {
        const id = previewKey(read);
        const slot = slots.current.get(id);
        const handed = slot?.content;

        if (!slot || !handed) {
            return;
        }

        const { signal } = slot.controller;
        const settle = (next: PreviewContent) => {
            if (!signal.aborted) {
                setContents((prev) => (prev.has(id) ? new Map(prev).set(id, next) : prev));
            }
        };

        setContents((prev) => {
            const shown = prev.get(id);

            return shown?.status === "text" ? new Map(prev).set(id, { ...shown, more: true }) : prev;
        });
        readText(handed, signal, limit).then(
            (excerpt) => settle(excerpt ? { status: "text", excerpt } : { status: "binary" }),
            (error: unknown) => settle({ status: "error", error }),
        );
    }, []);

    return { content, attempt, fail, retry, more };
};
