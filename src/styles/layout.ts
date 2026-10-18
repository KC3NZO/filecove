/*
 * The file manager lays itself out from its own width rather than the viewport's, so it
 * behaves the same full-screen, in a split pane or inside a dialog. Two named containers
 * drive this: the root (sidebar docking, header buttons) and the content view (list columns).
 */

export const ROOT_CONTAINER = "file-manager";
export const VIEW_CONTAINER = "file-manager-view";

/** Root has room for the full header toolbar. */
export const rootMedium = `@container ${ROOT_CONTAINER} (min-width: 600px)`;
/** Root has room to dock the sidebar beside the content instead of overlaying it. */
export const rootWide = `@container ${ROOT_CONTAINER} (min-width: 900px)`;

/** Content view fits the size, modified and star columns. */
export const viewMedium = `@container ${VIEW_CONTAINER} (min-width: 540px)`;
/** Content view fits every column. */
export const viewWide = `@container ${VIEW_CONTAINER} (min-width: 760px)`;

export const SIDEBAR_WIDTH = 248;

/** Shared by the sidebar header and the main header bar so the two line up. */
export const HEADER_HEIGHT = 52;
