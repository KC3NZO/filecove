/**
 * How much a media manager or a media picker does at once and keeps, each left to its default when
 * omitted. Counts are whole numbers, `Infinity` for no limit; a count below its least is taken as the
 * least. `FileManagerLimits` has these too.
 */
export interface MediaManagerLimits {
    /**
     * Calls to the adapter's `upload`, and the file manager's `createFolder` for a folder uploaded, an
     * upload runs at once, across every upload; 3 by default, at least 1.
     */
    uploads?: number;
    /** Copies and moves the adapter carries out at once, the media manager's Move among them; 3 by default, at least 1. */
    transfers?: number;
    /**
     * Calls to the adapter's `thumbnail` at once; 6 by default, as browsers open 6 connections to a
     * host, at least 1.
     */
    thumbnails?: number;
    /**
     * Thumbnails kept while nothing shows them, so scrolling back shows them at once, those shown
     * longest ago going first; 1,000 by default, at least 0.
     */
    keptThumbnails?: number;
    /**
     * Entries kept in the listings nothing shows, of folders, libraries and groups, so one opened again
     * shows at once, those shown longest ago going first, each listing counting one more than its
     * entries; 20,000 by default, at least 0. One whose listing went is listed afresh as it opens.
     */
    keptEntries?: number;
    /**
     * How long the typing has to stop for before the adapter's `search` is asked, in ms: the file
     * manager's search everywhere, and a media library's search; 300 by default. A finite number, 0 or
     * more.
     */
    searchDelay?: number;
}

/**
 * How much the file manager does at once and keeps, each left to its default when omitted. Counts
 * are whole numbers, `Infinity` for no limit; a count below its least is taken as the least.
 */
export interface FileManagerLimits extends MediaManagerLimits {
    /** Downloads the adapter prepares at once (`content`, `download`, `downloadAcross`); 3 by default, at least 1. */
    downloads?: number;
    /**
     * Changes kept to undo, with Ctrl+Z, the oldest going first; 20 by default, at least 0, which
     * leaves nothing to undo.
     */
    undoSteps?: number;
}
