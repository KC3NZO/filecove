import { GRID_SIZES, GRID_START, LIST_ICON_SIZES, LIST_START } from "../styles/layout";

import type { ViewMode, ViewZoom, ZoomStep } from "../types";

export const DEFAULT_ZOOM: ViewZoom = { list: 0, grid: 0 };

// How many sizes each view has, and which of them zoom 0 is.
const SIZES: Record<ViewMode, { count: number; start: number }> = {
    list: { count: LIST_ICON_SIZES.length, start: LIST_START },
    grid: { count: GRID_SIZES.length, start: GRID_START },
};

/** The size a view's zoom picks among its sizes, a zoom beyond either end taken as that end. */
const sizeIndex = (view: ViewMode, zoom: number) => {
    const { count, start } = SIZES[view];
    const index = start + (Number.isFinite(zoom) ? Math.round(zoom) : 0);

    return Math.min(Math.max(index, 0), count - 1);
};

/** The side of a list entry's icon or thumbnail at a zoom, in rem. */
export const listIconSize = (zoom: number) => LIST_ICON_SIZES[sizeIndex("list", zoom)];

/** The grid's icon and column sizes at a zoom, in rem. */
export const gridSize = (zoom: number) => GRID_SIZES[sizeIndex("grid", zoom)];

/** A view's zoom as it shows: a whole step from its start, within its sizes. */
const shownZoom = (view: ViewMode, zoom: number) => sizeIndex(view, zoom) - SIZES[view].start;

/** Whether two zooms are the same, view by view. */
export const sameZoom = (a: ViewZoom, b: ViewZoom) => a.list === b.list && a.grid === b.grid;

/** The step a view's zoom goes to from where it shows: one in or out, within its sizes, or 0. */
const steppedZoom = (view: ViewMode, zoom: number, step: ZoomStep) =>
    step === 0 ? 0 : shownZoom(view, shownZoom(view, zoom) + step);

/** Whether a view can zoom a step in or out, or back to its start, from where it shows. */
export const canZoom = (zoom: ViewZoom, view: ViewMode, step: ZoomStep) =>
    steppedZoom(view, zoom[view], step) !== shownZoom(view, zoom[view]);

/** The zoom with a view zoomed a step in or out from where it shows, or back to its start. */
export const zoomedBy = (zoom: ViewZoom, view: ViewMode, step: ZoomStep): ViewZoom => ({
    ...zoom,
    [view]: steppedZoom(view, zoom[view], step),
});

/** A view's size as a share of the one it starts at, 1.5 for 150%, as the view menu shows it. */
export const zoomScale = (zoom: ViewZoom, view: ViewMode) =>
    view === "list"
        ? listIconSize(zoom.list) / LIST_ICON_SIZES[LIST_START]
        : gridSize(zoom.grid).icon / GRID_SIZES[GRID_START].icon;
