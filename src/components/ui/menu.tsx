import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Menu as BaseMenu } from "@base-ui/react/menu";

import { DirectionContext } from "../../contexts/direction-context";
import { fmClasses } from "../../styles/classes";
import theme from "../../styles/theme.module.css";
import { cx } from "../../utils/cx";
import styles from "./menu.module.css";

interface MenuProps {
    open: boolean;
    /** The element the menu hangs under. */
    anchor?: Element | null;
    /** A point of the viewport the menu opens at, in place of an element, as a right-click's. */
    position?: { top: number; left: number };
    /**
     * Whether the part it was opened in runs right to left, which decides the side `align` means
     * and the way it opens from a point. The file manager's direction when omitted.
     */
    rtl?: boolean;
    /**
     * Which of the anchor's edges the menu lines up with: its start, the left unless it runs right
     * to left, or its end.
     */
    align?: "start" | "end";
    /** Under the anchor unless it's `top`, over it, as for a button at the bottom of its part. */
    side?: "top" | "bottom";
    /** Names the menu for screen readers. */
    label?: string;
    className?: string;
    onClose: () => void;
    /** Called once the menu has faded out, when what it showed can be let go. */
    onExited?: () => void;
    children: ReactNode;
}

// Whether the last thing pressed was a key, so a menu opened from the keyboard starts on its first
// item, as a native one does, and one opened by the pointer highlights nothing until it's moved.
// Listened for while any menu is mounted, open or not.
let keyboard = false;
let listeners = 0;

const sawKey = () => {
    keyboard = true;
};

const sawPointer = () => {
    keyboard = false;
};

const watchInput = () => {
    if (listeners++ === 0) {
        document.addEventListener("keydown", sawKey, true);
        document.addEventListener("pointerdown", sawPointer, true);
    }

    return () => {
        if (--listeners === 0) {
            document.removeEventListener("keydown", sawKey, true);
            document.removeEventListener("pointerdown", sawPointer, true);
        }
    };
};

const ITEMS = '[role^="menuitem"]:not([data-disabled])';

/**
 * A menu under an element or at a point, opened and closed by the part that owns it. It portals to
 * `<body>`, so it takes the file manager's direction (`DirectionContext`) and the theme's class.
 * Escape, a press outside it and Tab close it, and the focus goes back to where it was.
 *
 * A right-click outside the open menu closes it, rather than opening the browser's menu over it.
 * One on the menu, or the Menu key pressed in it, which some browsers send on its release after
 * the key press opened the menu, leaves it open.
 */
const Menu = ({
    open,
    anchor,
    position,
    rtl,
    align = "start",
    side = "bottom",
    label,
    className,
    onClose,
    onExited,
    children,
}: MenuProps) => {
    const dir = useContext(DirectionContext);
    const popupRef = useRef<HTMLDivElement>(null);
    // Still drawn while it fades out, when a right-click outside should do no more than it did.
    const [shown, setShown] = useState(open);
    const top = position?.top;
    const left = position?.left;

    const point = useMemo(
        () =>
            top === undefined || left === undefined
                ? undefined
                : { getBoundingClientRect: () => DOMRect.fromRect({ x: left, y: top, width: 0, height: 0 }) },
        [top, left],
    );

    if (open && !shown) {
        setShown(true);
    }

    useEffect(watchInput, []);

    useEffect(() => {
        if (!shown) {
            return;
        }

        const handleContextMenu = (event: MouseEvent) => {
            // Kept from the parts under the menu in React's tree too, which a portal's events reach.
            event.preventDefault();
            event.stopPropagation();

            if (!(event.target instanceof Element && event.target.closest('[role="menu"]'))) {
                onClose();
            }
        };

        document.addEventListener("contextmenu", handleContextMenu, true);

        return () => document.removeEventListener("contextmenu", handleContextMenu, true);
    }, [shown, onClose]);

    return (
        <BaseMenu.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onClose();
                }
            }}
            onOpenChangeComplete={(next) => {
                if (next) {
                    if (keyboard) {
                        popupRef.current?.querySelector<HTMLElement>(ITEMS)?.focus();
                    }
                } else {
                    setShown(false);
                    onExited?.();
                }
            }}
        >
            <BaseMenu.Portal>
                <BaseMenu.Positioner
                    dir={rtl === undefined ? dir : rtl ? "rtl" : "ltr"}
                    anchor={point ?? anchor}
                    side={side}
                    align={align}
                    collisionPadding={16}
                    className={cx(theme.theme, styles.positioner)}
                >
                    <BaseMenu.Popup ref={popupRef} dir={dir} aria-label={label} className={cx(fmClasses.menu, styles.popup, className)}>
                        {children}
                    </BaseMenu.Popup>
                </BaseMenu.Positioner>
            </BaseMenu.Portal>
        </BaseMenu.Root>
    );
};

interface MenuItemProps extends Omit<ComponentProps<typeof BaseMenu.Item>, "className" | "render"> {
    className?: string;
    /** Draws a rule under the item. */
    divider?: boolean;
    /** `menuitemcheckbox` or `menuitemradio` for an item that shows a state, with its `aria-checked`. */
    role?: "menuitem" | "menuitemcheckbox" | "menuitemradio";
    "aria-checked"?: boolean | "mixed";
}

/**
 * One item of a menu. Picking it doesn't close the menu: the part that owns the menu does, so an
 * item that only changes a setting can leave it open. `data-destructive` draws it as a deletion.
 */
export const MenuItem = ({ className, divider, role, "aria-checked": checked, ...props }: MenuItemProps) => (
    <BaseMenu.Item
        closeOnClick={false}
        className={cx(fmClasses.menuItem, styles.item, divider && styles.divided, className)}
        // The item names its own role last, so one that shows a state says so here.
        render={role ? (itemProps) => <div {...itemProps} role={role} aria-checked={checked} /> : undefined}
        {...props}
    />
);

/** The box an item's icon sits in, so the labels line up after it. */
export const MenuIcon = ({ className, ...props }: ComponentProps<"span">) => (
    <span className={cx(styles.icon, className)} {...props} />
);

interface MenuTextProps {
    /** Leaves the room an icon would take, for a label without one among labels that have one. */
    inset?: boolean;
    /** A second line under the label, in the secondary colour. */
    secondary?: ReactNode;
    /** Cuts each line short with an ellipsis rather than widening the menu. */
    noWrap?: boolean;
    className?: string;
    children: ReactNode;
}

/** An item's label, and what's under it. */
export const MenuText = ({ inset, secondary, noWrap, className, children }: MenuTextProps) => (
    <span className={cx(styles.text, inset && styles.inset, className)}>
        <span className={cx(styles.primary, noWrap && styles.noWrap)}>{children}</span>
        {secondary !== undefined && secondary !== null && (
            <span className={cx(styles.secondary, noWrap && styles.noWrap)}>{secondary}</span>
        )}
    </span>
);

/** An item's keys, after its label. */
export const MenuShortcut = ({ children }: { children: ReactNode }) => (
    <span className={styles.shortcut}>
        <bdi>{children}</bdi>
    </span>
);

/** A rule between two groups of items. */
export const MenuDivider = () => <BaseMenu.Separator className={styles.separator} />;

/** What the items after it are, read out by screen readers as it's drawn: not an item itself. */
export const MenuLabel = ({ className, ...props }: ComponentProps<"div">) => (
    <div role="presentation" className={cx(fmClasses.menuLabel, styles.label, className)} {...props} />
);

export default Menu;
