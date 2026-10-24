import { mirroredBarSx } from "./direction";
import { forcedBarSx } from "./mixins";

import type { SxProps, Theme } from "@mui/material/styles";

/*
 * The look the upload and download panels share: an inset card with a summary that folds a list of
 * rows away, each row an icon, its text and an action.
 */

export const panelSx: SxProps<Theme> = {
    flexShrink: 0,
    borderRadius: 3,
    overflow: "hidden",
    bgcolor: "background.paper",
};

export const panelHeaderSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minHeight: 52,
    paddingInlineStart: 2,
    paddingInlineEnd: 1,
};

/** Every status icon and row icon sits in the same column. */
export const panelSlotSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "1.5rem",
};

export const panelTextSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
};

export const panelTitleSx: SxProps<Theme> = {
    fontWeight: 600,
};

/** Points down while the list shows, to fold it away, and up while it's folded. */
export const panelToggleIconSx: SxProps<Theme> = {
    transition: "transform 150ms",
    '[aria-expanded="false"] > &': { transform: "rotate(180deg)" },
};

export const panelListSx: SxProps<Theme> = {
    m: 0,
    p: 0,
    listStyle: "none",
    maxHeight: "15rem",
    overflowY: "auto",
    borderTop: 1,
    borderColor: "divider",
};

export const panelRowSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minHeight: 52,
    paddingInlineStart: 2,
    paddingInlineEnd: 1,
    py: 0.5,
};

/**
 * A row's progress bar, which fills from the start side: MUI fills from the left unless the theme
 * says right to left.
 */
export const panelBarSx: SxProps<Theme> = [{ my: 0.5, height: 3, borderRadius: 1.5 }, mirroredBarSx, forcedBarSx];
