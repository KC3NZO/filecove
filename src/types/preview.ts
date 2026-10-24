// Internal to the package, not exported from the package entry.

import type { FilePreviewer } from "./previewer";

/**
 * How the preview shows a file: as the browser shows images, videos, audio and PDFs, the start of
 * a text file, a font's specimen, through a previewer of the app's own ("custom"), or "none" for a
 * file it can only describe.
 */
export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "font" | "custom" | "none";

/** How the preview shows a file, and what it loads for it first. */
export interface PreviewPlan {
    kind: PreviewKind;
    /**
     * What's loaded: nothing, the adapter's `content` for its URL, the start of the file as text,
     * or a font, from its URL or its bytes.
     */
    reads: "none" | "content" | "text" | "font";
    /** The app's own previewer, for "custom". */
    previewer?: FilePreviewer;
}

/** The start of a text file, as the preview shows it. */
export interface TextExcerpt {
    text: string;
    /** Whether the file goes on past `text`. */
    truncated: boolean;
    /** How many bytes were read, at most; reading more reads that much again. */
    limit: number;
}

/** What the preview has loaded to show a file. */
export type PreviewContent =
    /** The blob is there when the contents came as one, for a previewer of the app's own. */
    | { status: "url"; url: string; blob?: Blob }
    /** `more` while more of it is being read, after "Show more". */
    | { status: "text"; excerpt: TextExcerpt; more?: boolean }
    /** A font, added to the page's fonts under a family name of its own while it's kept. */
    | { status: "font"; family: string }
    /** A text file that turned out not to be text. */
    | { status: "binary" }
    /** What the adapter rejected with, or the browser failed with, worded by the preview. */
    | { status: "error"; error: unknown };
