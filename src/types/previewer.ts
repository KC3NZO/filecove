import type { ReactNode } from "react";

import type { FileAdapter, FileEntry } from "./adapter";

/**
 * What the preview hands a file to a previewer of the app's own as: nothing ("none"), the adapter's
 * `content` as it comes ("content"), or the start of the file read as text ("text").
 */
export type PreviewerReads = "none" | "content" | "text";

/** What a previewer of the app's own is handed for the file it shows (`FilePreviewer.render`). */
export interface PreviewerProps {
    entry: FileEntry;
    /** The adapter serving it, for a previewer that asks it for more, e.g. through a method of its own. */
    adapter: FileAdapter;
    /**
     * Where the file's contents are, from the adapter's `content`, when the previewer `reads` them:
     * the URL to load them from, made for a blob and revoked once the preview has moved on, and the
     * blob itself when they came as one.
     */
    content?: { url: string; blob?: Blob };
    /**
     * The start of the file, read as text as the preview reads a text file, when the previewer
     * `reads` "text": up to 256 kB at first, decoded as UTF-8, UTF-16 when it starts with a byte
     * order mark, or Windows-1252 when it isn't valid UTF-8.
     */
    text?: string;
    /**
     * Whether the file goes on past `text`. The preview says so under it, with a button that reads
     * as much again, handing the previewer the longer text.
     */
    truncated: boolean;
    /**
     * Shows the file as failed, with the message of `error` when it's an `Error`, and Try again,
     * which loads it afresh and renders the previewer again. A previewer throwing as it renders
     * fails the same way, rather than taking the file manager down.
     */
    onError: (error: unknown) => void;
}

/**
 * Shows files of some kind in the preview, in the app's own way: highlighted code, rendered
 * Markdown, an office document, what's in an archive, or a format the browser can't draw. The file
 * manager builds none of these in, which would weigh down every app with libraries most don't need.
 *
 * It's rendered in the preview's body, which it fills, keyed by the file, and inside `Suspense`,
 * so a previewer loading its library with `React.lazy` shows the preview's spinner meanwhile. The
 * preview keeps its own keys and swipes: a key the previewer handles itself, it calls
 * `preventDefault` on, and a part that pans sideways itself, such as a wide table, takes the
 * attribute `data-no-swipe`, so swiping there doesn't step to another file.
 */
export interface FilePreviewer {
    /** Tells it apart, and stays the same for the same previewer. */
    id: string;
    /**
     * Whether it shows `entry`, a file. Previewers are asked in order, before the file manager's own
     * previews, so one can take over images or text too. Without the adapter's `content`, only one
     * that reads "none" can show anything.
     */
    accepts: (entry: FileEntry) => boolean;
    /**
     * What the preview loads for it before rendering it, and loads ahead for the next file, as it
     * does its own: "content", the default, the adapter's `content`; "text", the start of the file
     * read as text; or "none", nothing, for a previewer getting what it needs itself.
     */
    reads?: PreviewerReads;
    render: (props: PreviewerProps) => ReactNode;
}
