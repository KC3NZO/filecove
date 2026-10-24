import { useContext } from "react";
import IconButton from "@mui/material/IconButton";
import type { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { DirectionContext } from "../../contexts/direction-context";

// Keeps a tooltip clear of the viewport's edges, so a button at the edge of the screen (the header's
// last, the sidebar's first) doesn't get one touching it. The arrow still points at the button.
// At module scope, since the tooltip builds its options again whenever this changes.
const popperOptions = {
    modifiers: [{ name: "preventOverflow", options: { padding: 8 } }],
};

interface TooltipIconButtonProps extends Omit<IconButtonProps, "aria-label" | "title"> {
    /** Names the button for screen readers and shows as its tooltip. */
    label: string;
}

/**
 * An icon-only button, named by `label` for screen readers and showing it as a tooltip with an arrow
 * on hover or keyboard focus, after a desktop-like half second, and at once while moving along a
 * row of them, at least 8px from the viewport's edges.
 * The tooltip portals to `<body>`, so it takes the file manager's direction (`DirectionContext`).
 * A disabled button shows none, since it takes no pointer events.
 */
const TooltipIconButton = ({ label, ...props }: TooltipIconButtonProps) => {
    const dir = useContext(DirectionContext);

    return (
        <Tooltip title={label} arrow enterDelay={500} slotProps={{ popper: { dir, popperOptions } }}>
            <IconButton aria-label={label} {...props} />
        </Tooltip>
    );
};

export default TooltipIconButton;
