import type { GridSize } from "../types";

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

/*
 * The content's sizes at each zoom step, smallest first, in rem; zoom 0 is `LIST_START` and
 * `GRID_START`, and the others are 75%, 150%, 200% and 300% of it, as the view menu shows them.
 * The list's is the icon or thumbnail beside each name, which its rows grow with. The grid's
 * columns leave a tile's name room for a few words beside a small icon, and hug a large one.
 */
export const LIST_ICON_SIZES: readonly number[] = [1.3125, 1.75, 2.625, 3.5];
export const LIST_START = 1;
export const GRID_SIZES: readonly GridSize[] = [
    { icon: 2.625, column: 5.5, wideColumn: 6.5 },
    { icon: 3.5, column: 6.5, wideColumn: 7.5 },
    { icon: 5.25, column: 7.5, wideColumn: 9 },
    { icon: 7, column: 9, wideColumn: 11 },
    { icon: 10.5, column: 12.5, wideColumn: 14.5 },
];
export const GRID_START = 1;

export const SIDEBAR_WIDTH = 248;

/** The docked properties' width, in px, until the user resizes them. */
export const PROPERTIES_WIDTH = 300;
/** How narrow and how wide the docked properties can be made, in px. */
export const PROPERTIES_MIN_WIDTH = 240;
export const PROPERTIES_MAX_WIDTH = 640;
/** How far the arrow keys move the docked properties' edge, in px. */
export const PROPERTIES_WIDTH_STEP = 16;
/**
 * The room the docked properties leave the content view at least, in px, so it keeps the list's
 * size and date columns (`viewMedium`). The margins around the content and the properties come on
 * top of it, which the pane adds as it docks.
 */
export const PROPERTIES_CONTENT_ROOM = 540;

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
