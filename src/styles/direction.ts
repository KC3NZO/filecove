import type { SxProps, Theme } from "@mui/material/styles";

/*
 * Overrides for MUI's own physical left and right, for a page that sets only `dir="rtl"`. MUI
 * relies on Emotion's RTL plugin (and the theme's `direction`) to flip them, which the file manager
 * doesn't ask of its consumer. Each puts the logical property after a reset of the physical one,
 * which is the order that works with the plugin too, since it turns the reset into its mirror image
 * and the logical property is not flipped. See `rtl.md`.
 */

/** `DialogActions`, whose buttons are spaced with a `margin-left`. */
export const dialogActionsSx: SxProps<Theme> = {
    "& > :not(style) ~ :not(style)": { marginLeft: 0, marginInlineStart: "8px" },
};

/**
 * A menu item whose label has no icon, inset to line up with the labels that have one, which
 * `ListItemText` does with a `padding-left`. It has to match MUI's descendant selector to win.
 */
export const insetLabelSx = {
    "& .MuiListItemText-inset": { paddingLeft: 0, paddingInlineStart: "36px" },
} satisfies SxProps<Theme>;

const mirrored = {
    "&:dir(rtl)": { scale: "-1 1" },
} satisfies SxProps<Theme>;

/**
 * A `LinearProgress` that fills, or sweeps, from the start side, the right right to left. MUI flips
 * it by the theme's `direction` rather than the page's, so it's left alone when the theme already
 * says right to left, or it would be flipped back.
 */
export const mirroredBarSx = (theme: Theme) => (theme.direction === "rtl" ? {} : mirrored);
