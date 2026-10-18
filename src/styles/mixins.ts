import type { Theme } from "@mui/material/styles";

// `theme.vars` is set when the consumer's theme uses CSS variables; read tokens from it
// when present so the colors follow light/dark switching without a re-render.

/** Accent-tinted background for the selected location or file. */
export const selectedBackground = (theme: Theme) => {
    const tokens = theme.vars || theme;

    return theme.alpha(tokens.palette.primary.main, tokens.palette.action.selectedOpacity);
};

/** Faint zebra stripe for alternate list rows. */
export const stripeBackground = (theme: Theme) =>
    theme.alpha((theme.vars || theme).palette.text.primary, 0.03);

/** Keyboard focus ring for ButtonBase elements; works whether or not ripples are enabled. */
export const focusRing = {
    "&.Mui-focusVisible": {
        outline: "2px solid",
        outlineColor: "primary.main",
        outlineOffset: "-2px",
    },
};
