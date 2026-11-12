import { useContext } from "react";
import type { ReactElement, ReactNode } from "react";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { DirectionContext } from "../../contexts/direction-context";
import { fmClasses } from "../../styles/classes";
import theme from "../../styles/theme.module.css";
import { cx } from "../../utils/cx";
import styles from "./button.module.css";

interface TooltipProps {
    /** What the tooltip says. */
    title: ReactNode;
    /** Shows no tooltip, as for a button that takes no press. */
    disabled?: boolean;
    /** The element it's about, which takes the tooltip's handlers. */
    children: ReactElement<Record<string, unknown>>;
}

/** How long the pointer rests on a button before its tooltip shows, in ms, as on a desktop. */
const DELAY = 500;

/**
 * Groups the tooltips below it, so that after one has shown, the next shows at once while the
 * pointer moves along a row of buttons. Each root has one.
 */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
    <BaseTooltip.Provider delay={DELAY}>{children}</BaseTooltip.Provider>
);

/**
 * A tooltip with an arrow under its element, shown on hover or keyboard focus after a desktop-like
 * half second, at least 8px from the viewport's edges, so a button at the edge of the screen
 * doesn't get one touching it. It portals to `<body>`, so it takes the file manager's direction
 * (`DirectionContext`) and the theme's class.
 */
const Tooltip = ({ title, disabled, children }: TooltipProps) => {
    const dir = useContext(DirectionContext);

    return (
        <BaseTooltip.Root disabled={disabled}>
            <BaseTooltip.Trigger delay={DELAY} render={children} />
            <BaseTooltip.Portal>
                <BaseTooltip.Positioner
                    dir={dir}
                    side="bottom"
                    sideOffset={10}
                    collisionPadding={8}
                    className={cx(theme.theme, styles.tooltipPositioner)}
                >
                    <BaseTooltip.Popup className={cx(styles.tooltip, fmClasses.tooltip)}>
                        <BaseTooltip.Arrow className={styles.tooltipArrow} />
                        {title}
                    </BaseTooltip.Popup>
                </BaseTooltip.Positioner>
            </BaseTooltip.Portal>
        </BaseTooltip.Root>
    );
};

export default Tooltip;
