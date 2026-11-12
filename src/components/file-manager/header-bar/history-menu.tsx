import { isRtl } from "../../../utils/dom";
import IconSlot from "../../icons/icon-slot";
import Menu, { MenuIcon, MenuItem, MenuText } from "../../ui/menu";
import styles from "./history-menu.module.css";

import type { HistoryStop } from "../../../types";

interface HistoryMenuProps {
    open: boolean;
    /** The back or forward button the list hangs from, kept while the menu fades out. */
    anchor: HTMLElement;
    /** Names the list for screen readers. */
    label: string;
    /** The places the button leads to, nearest first. */
    stops: HistoryStop[];
    onPick: (by: number) => void;
    onClose: () => void;
}

/**
 * The places back or forward lead to, nearest first, opened by right-clicking or long-pressing the
 * button, as GNOME Files shows them. Picking one goes straight there.
 */
const HistoryMenu = ({ open, anchor, label, stops, onPick, onClose }: HistoryMenuProps) => (
    // Hangs from the button's start edge, since it opens below a button near the header's start.
    <Menu open={open} anchor={anchor} rtl={isRtl(anchor)} label={label} onClose={onClose}>
        {stops.map(({ by, label: place, location, icon }, position) => (
            <MenuItem
                key={by}
                className={styles.item}
                divider={position < stops.length - 1}
                onClick={() => {
                    onClose();
                    onPick(by);
                }}
            >
                <MenuIcon>
                    <IconSlot icon={icon} />
                </MenuIcon>
                <MenuText noWrap secondary={location ? <bdi>{location}</bdi> : undefined}>
                    <bdi>{place}</bdi>
                </MenuText>
            </MenuItem>
        ))}
    </Menu>
);

export default HistoryMenu;
