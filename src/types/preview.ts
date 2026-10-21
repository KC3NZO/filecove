// Internal to the package, not exported from the package entry.

/** How the preview shows a file, or "none" for a file it can only describe. */
export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | "none";

/** The start of a text file, as the preview shows it. */
export interface TextExcerpt {
    text: string;
    /** Whether the file goes on past `text`. */
    truncated: boolean;
}
