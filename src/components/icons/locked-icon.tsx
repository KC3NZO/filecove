import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import Icon from "./icon";

interface LockedIconProps {
    /** Whether to show the lock; without it, the icon shows as it is. */
    locked: boolean;
    children: ReactNode;
}

const wrapperSx: SxProps<Theme> = {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
};

// A lock on a disc at the icon's bottom end corner, as GNOME Files marks what can't be written,
// sized with the icon. It gives way to the check badge of touch selection mode (`CheckBadge`), which
// takes the same corner. Screen readers hear it from the item's own description.
const emblemSx: SxProps<Theme> = {
    position: "absolute",
    insetInlineEnd: "-10%",
    bottom: "-6%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "max(0.625rem, 50%)",
    aspectRatio: "1",
    borderRadius: "50%",
    bgcolor: "background.paper",
    color: "text.secondary",
    pointerEvents: "none",
    "& > svg": { width: "75%", height: "75%" },
    '[data-selecting="true"] &': { display: "none" },
};

/** An icon with a lock at its corner, for a folder nothing can be put in (`lockedFolder`). */
const LockedIcon = ({ locked, children }: LockedIconProps) =>
    locked ? (
        <Box component="span" sx={wrapperSx}>
            {children}
            <Box component="span" sx={emblemSx} aria-hidden>
                <Icon name="lock" />
            </Box>
        </Box>
    ) : (
        children
    );

export default LockedIcon;
