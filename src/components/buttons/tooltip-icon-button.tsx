import IconButton from "../ui/icon-button";
import type { IconButtonProps } from "../ui/icon-button";
import Tooltip from "../ui/tooltip";

interface TooltipIconButtonProps extends Omit<IconButtonProps, "aria-label" | "title"> {
    /** Names the button for screen readers and shows as its tooltip. */
    label: string;
}

/**
 * An icon-only button, named by `label` for screen readers and showing it as a tooltip with an arrow
 * on hover or keyboard focus, after a desktop-like half second, and at once while moving along a
 * row of them, at least 8px from the viewport's edges.
 * The tooltip portals to `<body>`, so it takes the file manager's direction (`DirectionContext`).
 * A disabled button shows none.
 */
const TooltipIconButton = ({ label, ...props }: TooltipIconButtonProps) => (
    <Tooltip title={label} disabled={props.disabled}>
        <IconButton aria-label={label} {...props} />
    </Tooltip>
);

export default TooltipIconButton;
