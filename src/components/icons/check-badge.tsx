import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import Icon from "./icon";

// Only shown in touch selection mode, set as `data-selecting` on the folder view or the sidebar
// tree: an empty ring at the icon's bottom end corner, filled with a check once the item's row or
// tile is `data-selected`. The icon's wrapper places it.
const badgeSx: SxProps<Theme> = {
    display: "none",
    position: "absolute",
    insetInlineEnd: -2,
    bottom: -2,
    width: "max(0.875rem, 36%)",
    aspectRatio: "1",
    alignItems: "center",
    justifyContent: "center",
    border: 2,
    borderColor: "text.secondary",
    borderRadius: "50%",
    bgcolor: "background.paper",
    color: "primary.contrastText",
    pointerEvents: "none",
    "& > svg": { width: "80%", height: "80%", visibility: "hidden" },
    '[data-selecting="true"] &': { display: "flex" },
    '[data-selected="true"] &': { borderColor: "primary.main", bgcolor: "primary.main" },
    '[data-selected="true"] & > svg': { visibility: "visible" },
};

/** The check badge of touch selection mode, drawn only; the item says it's selected itself. */
const CheckBadge = () => (
    <Box component="span" sx={badgeSx} aria-hidden>
        <Icon name="check" />
    </Box>
);

export default CheckBadge;
