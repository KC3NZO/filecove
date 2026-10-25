/**
 * How much the file manager does at once and keeps, each left to its default when omitted. Counts
 * are whole numbers, `Infinity` for no limit; a count below its least is taken as the least.
 */
export interface FileManagerLimits {
    /** Calls to the adapter's `upload` and `createFolder` an upload runs at once, across every upload; 3 by default, at least 1. */
    uploads?: number;
    /** Downloads the adapter prepares at once (`content`, `download`, `downloadAcross`); 3 by default, at least 1. */
    downloads?: number;
    /** Copies and moves the adapter carries out at once; 3 by default, at least 1. */
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
     * Entries kept in the folder listings nothing shows, so a folder opened again shows at once,
     * those shown longest ago going first, each listing counting one more than its entries; 20,000
     * by default, at least 0. A folder whose listing went is listed afresh as it opens.
     */
    keptEntries?: number;
    /**
     * Changes kept to undo, with Ctrl+Z, the oldest going first; 20 by default, at least 0, which
     * leaves nothing to undo.
     */
    undoSteps?: number;
    /**
     * How long the typing has to stop for before a search everywhere asks the adapter's `search`, in
     * ms; 300 by default. A finite number, 0 or more.
     */
    searchDelay?: number;
}
