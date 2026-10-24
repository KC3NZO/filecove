import type { SxProps, Theme } from "@mui/material/styles";

// `theme.vars` is set when the consumer's theme uses CSS variables; read tokens from it
// when present so the colors follow light/dark switching without a re-render.
//
// MUI's `action` opacities are tuned for menus and lists on a plain surface. Over the striped
// rows of a file view they barely show, light mode especially, so the helpers below build on
// them with a fixed boost. They stay relative to the theme's own values, so a theme that
// raises or lowers them still moves these.

/** Neutral tint for a hovered row or tile, clearly stronger than the list's zebra stripe. */
export const hoverBackground = (theme: Theme) => {
    const tokens = theme.vars || theme;

    return theme.alpha(tokens.palette.text.primary, `${tokens.palette.action.hoverOpacity} + 0.04`);
};

/** Accent-tinted background for the selected location or file. */
export const selectedBackground = (theme: Theme) => {
    const tokens = theme.vars || theme;

    return theme.alpha(tokens.palette.primary.main, `${tokens.palette.action.selectedOpacity} + 0.12`);
};

/** A selected row or tile under the pointer, a step stronger than selected alone. */
export const selectedHoverBackground = (theme: Theme) => {
    const tokens = theme.vars || theme;

    return theme.alpha(
        tokens.palette.primary.main,
        `${tokens.palette.action.selectedOpacity} + ${tokens.palette.action.hoverOpacity} + 0.12`,
    );
};

/** Faint zebra stripe for alternate list rows. */
export const stripeBackground = (theme: Theme) =>
    theme.alpha((theme.vars || theme).palette.text.primary, 0.03);

/**
 * Marks a row or tile whose entry is cut, until it's pasted: its contents fade, as in desktop file
 * managers, and a dashed outline traces it. Only the children fade, so its hover and selection
 * backgrounds keep their strength. Spread into an `sx` object of an element with `data-cut`.
 */
export const cutMarker = {
    "& > *": { transition: "opacity 150ms" },
    '&[data-cut="true"]': {
        outline: "1px dashed",
        outlineColor: "text.secondary",
        outlineOffset: "-1px",
        "& > *": { opacity: 0.45 },
    },
};

/**
 * Marks rows or tiles while entries are dragged: the dragged ones fade, as cut ones do, and the
 * folder they'd be dropped into takes the selection's color inside an accent outline. Keyed off
 * `data-dragged` and `data-drop-target`. Spread last into the `sx` object, so the drop target wins
 * over hover, selection and the cut outline.
 */
export const dragMarkers = (theme: Theme) => ({
    '&[data-dragged="true"] > *': { opacity: 0.45 },
    '&[data-drop-target="true"], &[data-drop-target="true"]:hover': {
        bgcolor: selectedHoverBackground(theme),
        outline: "2px solid",
        outlineColor: "primary.main",
        outlineOffset: "-2px",
    },
});

/** The outline every keyboard focus ring draws, inside the element's edge. */
export const focusOutline = {
    outline: "2px solid",
    outlineColor: "primary.main",
    outlineOffset: "-2px",
};

/** Keyboard focus ring for ButtonBase elements; works whether or not ripples are enabled. */
export const focusRing = {
    "&.Mui-focusVisible": focusOutline,
};

/**
 * Keyboard focus ring for other focusable elements, such as list rows and grid tiles. Spread it
 * after `cutMarker` and before `dragMarkers`, so it wins over the cut outline and a drop target wins over it.
 */
export const focusVisibleRing = {
    "&:focus-visible": focusOutline,
};

/**
 * Windows' High Contrast themes, and any other forced colors mode, drop every background colour and
 * box shadow and put the user's own colours in place of text, border and outline colours. What a
 * background alone shows, a selection, a progress bar's fill, a pressed button's accent or a menu's
 * edge, would vanish, so under this key it's shown in system colours, which the mode keeps.
 */
export const forcedColors = "@media (forced-colors: active)";

/**
 * A selected row, tile or tree row (`data-selected`) in the system's selection colours, as a native
 * list shows it. Text inside inherits `HighlightText`, as the mode resets its colours to inherit.
 * Goes under `forcedColors`, after the rules it overrides.
 */
export const forcedSelected = {
    '&[data-selected="true"]': { bgcolor: "Highlight", color: "HighlightText" },
};

/** A pressed toggle button (`aria-pressed`) in the system's selection colour. Goes under `forcedColors`. */
export const forcedPressed = {
    '&[aria-pressed="true"]': { color: "Highlight" },
};

/** An edge for a surface that only a shadow or a background set apart. Goes under `forcedColors`. */
export const forcedEdge = {
    outline: "1px solid CanvasText",
};

/** A `LinearProgress` whose fill shows in the system's selection colour. */
export const forcedBarSx = {
    [forcedColors]: { "& .MuiLinearProgress-bar": { bgcolor: "Highlight" } },
};

/** The paper of the file manager's menus, edged in forced colors, where its shadow is dropped. */
export const menuPaperSx: SxProps<Theme> = {
    minWidth: 220,
    borderRadius: 2,
    [forcedColors]: forcedEdge,
};

/** Hides text from view while screen readers still read it, e.g. a column's sort order or a live status. */
export const visuallyHiddenSx: SxProps<Theme> = {
    position: "absolute",
    width: "1px",
    height: "1px",
    m: "-1px",
    p: 0,
    border: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
};

/**
 * The paper of the file manager's dialogs. It takes the window's own surface instead of MUI's
 * elevated Paper, whose white overlay turns any dark background grey, and an outline marks its
 * edge where a shadow doesn't show against a dark backdrop.
 */
export const dialogPaperSx: SxProps<Theme> = {
    borderRadius: 3,
    border: 1,
    borderColor: "divider",
    bgcolor: "background.default",
    backgroundImage: "none",
};
