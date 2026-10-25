import { useContext } from "react";

import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { menuPaperSx } from "../../../styles/mixins";
import { isRtl } from "../../../utils/dom";
import IconSlot from "../../icons/icon-slot";

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

// Long names are cut short rather than widening the menu.
const itemSx: SxProps<Theme> = { maxWidth: "min(24rem, 90vw)" };

const textSx: SxProps<Theme> = { minWidth: 0 };

const slotProps = (label: string): MenuProps["slotProps"] => ({
    paper: { sx: menuPaperSx },
    list: { dense: true, "aria-label": label },
});

// Hangs from the button's start edge, since it opens below a button near the header's start.
const ORIGINS: Record<"ltr" | "rtl", Pick<MenuProps, "anchorOrigin" | "transformOrigin">> = {
    ltr: {
        anchorOrigin: { vertical: "bottom", horizontal: "left" },
        transformOrigin: { vertical: "top", horizontal: "left" },
    },
    rtl: {
        anchorOrigin: { vertical: "bottom", horizontal: "right" },
        transformOrigin: { vertical: "top", horizontal: "right" },
    },
};

/**
 * The places back or forward lead to, nearest first, opened by right-clicking or long-pressing the
 * button, as GNOME Files shows them. Picking one goes straight there.
 */
const HistoryMenu = ({ open, anchor, label, stops, onPick, onClose }: HistoryMenuProps) => {
    const dir = useContext(DirectionContext);

    return (
        <Menu
            dir={dir}
            open={open}
            anchorEl={anchor}
            {...ORIGINS[isRtl(anchor) ? "rtl" : "ltr"]}
            slotProps={slotProps(label)}
            onClose={onClose}
        >
            {stops.map(({ by, label: place, location, icon }, position) => (
                <MenuItem
                    key={by}
                    sx={itemSx}
                    divider={position < stops.length - 1}
                    onClick={() => {
                        onClose();
                        onPick(by);
                    }}
                >
                    <ListItemIcon>
                        <IconSlot icon={icon} />
                    </ListItemIcon>
                    <ListItemText
                        sx={textSx}
                        primary={<bdi>{place}</bdi>}
                        secondary={location ? <bdi>{location}</bdi> : undefined}
                        slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                    />
                </MenuItem>
            ))}
        </Menu>
    );
};

export default HistoryMenu;
