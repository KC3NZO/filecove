import { joinIsolated } from "./bidi";
import { acceptsFile, uploadPatterns } from "./files";

import type {
    AssetHold,
    AssetProcessing,
    AssetState,
    DroppedFiles,
    FileAdapter,
    FileEntry,
    IconName,
    Locale,
    MediaKind,
    MediaLayout,
    MediaSection,
    MediaUploadCheck,
    RefusedName,
} from "../types";

/** The icon of a library of each kind, where its section brings none, and of its empty state. */
export const KIND_ICONS: Record<MediaKind, IconName> = {
    image: "pictures",
    video: "videos",
    audio: "music",
    document: "documents",
};

/** The layouts a library offers, the first as it starts: its own, or its kind's only one. */
export const layoutsOf = (section: MediaSection): readonly MediaLayout[] =>
    section.layouts?.length ? section.layouts : [section.kind === "audio" ? "list" : "grid"];

/**
 * Sorts what was picked, dropped or pasted into a library before anything is sent: files of types it
 * doesn't take (`acceptUploads`), folders, as a library is listed flat, and names its backend's own
 * rules refuse (`checkName`, asked with the library's root as the folder) are left out.
 */
export const checkMediaUpload = (
    section: MediaSection,
    adapter: FileAdapter,
    { files, folders }: DroppedFiles,
): MediaUploadCheck => {
    const patterns = uploadPatterns(section);
    const misnamed: RefusedName[] = [];
    const sent = files.filter((file) => {
        if (!acceptsFile(patterns, file)) {
            return false;
        }

        const reason = adapter.checkName?.(file.name, { kind: "file", parentId: section.rootId });

        if (reason) {
            misnamed.push({ name: file.name, reason });
        }

        return !reason;
    });

    return { files: sent, refused: files.filter((file) => !acceptsFile(patterns, file)), folders, misnamed };
};

/**
 * What fields in an upload form are handed as their entry, which a definition's functions take, as
 * nothing is uploaded yet: the first file's name and type, the files' size together, and no id.
 */
export const uploadStandIn = (files: readonly File[]): FileEntry => ({
    id: "",
    name: files[0]?.name ?? "",
    kind: "file",
    size: files.reduce((total, file) => total + file.size, 0),
    mimeType: files[0]?.type || undefined,
});

/**
 * An asset as the backend's latest word on its processing has it, where its listing said it was
 * being processed: with how it stands now, or once it's done, as the backend handed it over, or
 * else as listed without it. What's listed without it is usable, whatever was said before.
 */
export const withState = (entry: FileEntry, state: AssetState | undefined): FileEntry => {
    if (!entry.processing || !state) {
        return entry;
    }

    if (state.status === "ready") {
        return state.entry ?? { ...entry, processing: undefined };
    }

    return { ...entry, processing: state };
};

// The line and the bar of the backend's work on an asset: what it's doing and how far along, or that
// it failed.
const standing = (
    processing: AssetProcessing,
    { text, formatPercent }: Pick<Locale, "text" | "formatPercent">,
): AssetHold => {
    if (processing.status === "failed") {
        return { status: "failed", text: text.mediaProcessingFailed, detail: processing.message || undefined };
    }

    const step = processing.label || text.mediaProcessing;
    const { progress } = processing;

    return {
        status: "processing",
        progress,
        text: progress === undefined ? step : joinIsolated([step, formatPercent(progress)]),
    };
};

/**
 * Why an asset can't be chosen now, in one line, or nothing when it can: its backend's work on it,
 * with what it's doing and how far along, or failed, unless it's usable all the same; or its library
 * refusing it, with why.
 */
export const holdOf = (
    entry: FileEntry,
    section: MediaSection,
    locale: Pick<Locale, "text" | "formatPercent">,
): AssetHold | undefined => {
    const { processing } = entry;

    if (processing && !processing.usable) {
        return standing(processing, locale);
    }

    const allowed = section.selectable?.(entry) ?? true;

    return allowed === true
        ? undefined
        : { status: "refused", text: typeof allowed === "string" && allowed ? allowed : locale.text.mediaUnavailable };
};

/**
 * The backend's work on an asset that can be used all the same, in the same line and bar, or nothing
 * when there's none: it shows, but holds nothing back.
 */
export const workOf = (entry: FileEntry, locale: Pick<Locale, "text" | "formatPercent">) =>
    entry.processing?.usable ? standing(entry.processing, locale) : undefined;
