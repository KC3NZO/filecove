import type { SxProps, Theme } from "@mui/material/styles";

import { focusOutline } from "./mixins";

/**
 * The pill that takes the path bar's place in the header, for the search field and the path field,
 * in the path bar's shape so the header doesn't move as one swaps for another.
 */
export const headerFieldSx = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    minWidth: 0,
    height: 34,
    paddingInlineStart: 1.25,
    paddingInlineEnd: 0.25,
    borderRadius: 2,
    bgcolor: "action.hover",
    color: "text.secondary",
    "&:has(input:focus)": focusOutline,
} satisfies SxProps<Theme>;

/**
 * The text typed in either field. Each line runs the way its own letters do, or else the way the
 * page does. The browser's own clear button of a search input is left out, for the ✕ beside it.
 */
export const headerInputSx = {
    flex: 1,
    minWidth: 0,
    color: "text.primary",
    fontSize: "0.875rem",
    "& input": { unicodeBidi: "plaintext" },
    "& input::-webkit-search-cancel-button, & input::-webkit-search-decoration": { appearance: "none" },
} satisfies SxProps<Theme>;
