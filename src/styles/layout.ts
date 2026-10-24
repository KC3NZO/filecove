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
/**
 * Root has room to dock the properties on the content's other side too, leaving the content wide
 * enough for the list's size and date columns.
 */
export const rootExtraWide = `@container ${ROOT_CONTAINER} (min-width: 1100px)`;

/** Content view fits the size, modified and star columns. */
export const viewMedium = `@container ${VIEW_CONTAINER} (min-width: 540px)`;
/** Content view fits every column. */
export const viewWide = `@container ${VIEW_CONTAINER} (min-width: 760px)`;

export const SIDEBAR_WIDTH = 248;

export const PROPERTIES_WIDTH = 300;

/** Shared by the sidebar header and the main header bar so the two line up. */
export const HEADER_HEIGHT = 52;

/*
 * Heights of the sidebar tree's rows, in px. The tree only renders the rows in or near view, and
 * places each one itself from these.
 */
export const TREE_SECTION_HEIGHT = 36;
export const TREE_FOLDER_HEIGHT = 30;
export const TREE_CAPTION_HEIGHT = 28;
export const TREE_DIVIDER_HEIGHT = 17;

/*
 * The preview portals out of the file manager, where the root's queries don't reach, so its header
 * and its image are containers of their own.
 */
export const PREVIEW_HEADER_CONTAINER = "file-manager-preview-header";
export const PREVIEW_IMAGE_CONTAINER = "file-manager-preview-image";

/** The preview's header has room for the counter between its arrows. */
export const previewHeaderMedium = `@container ${PREVIEW_HEADER_CONTAINER} (min-width: 480px)`;
/** The preview's header has room for its actions, and the app's, as buttons beside the file's name. */
export const previewHeaderWide = `@container ${PREVIEW_HEADER_CONTAINER} (min-width: 640px)`;
/** The previewed image has room for the zoom's percentage between its buttons. */
export const previewImageWide = `@container ${PREVIEW_IMAGE_CONTAINER} (min-width: 360px)`;
