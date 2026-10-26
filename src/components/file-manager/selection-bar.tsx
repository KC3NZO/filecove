import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";

interface SelectionBarProps {
    /** How many entries are selected. */
    count: number;
    /** How many entries the folder has. */
    total: number;
    hasActions: boolean;
    onClose: () => void;
    onSelectAll: () => void;
    onSelectNone: () => void;
    /** Opens the action menu for the selection, below the given button. */
    onMenu: (button: HTMLElement) => void;
}

// Sticks to the bottom of the scroll panel, within thumb reach, and sits at the bottom of short
// folders too because the surface is a column at least as tall as the panel.
const barSx: SxProps<Theme> = {
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    mt: "auto",
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    minHeight: 52,
    mx: 1,
    mb: 1,
    px: 0.5,
    borderRadius: 3,
    border: 1,
    borderColor: "divider",
    bgcolor: "background.paper",
    boxShadow: 6,
};

const countSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
};

/** The touch selection mode's bar: leave the mode, the count, select all or none, and the action menu. */
const SelectionBar = ({ count, total, hasActions, onClose, onSelectAll, onSelectNone, onMenu }: SelectionBarProps) => {
    const allSelected = total > 0 && count === total;
    const { text } = useLocale();

    return (
        // Its taps are its own, not clicks on the folder's empty space.
        <Box sx={barSx} data-no-marquee onClick={(event) => event.stopPropagation()}>
            <TooltipIconButton label={text.doneSelecting} onClick={onClose}>
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
            <Typography variant="body2" noWrap sx={countSx}>
                {count === 0 ? text.selectItems : text.selectionCount(count)}
            </Typography>
            <Button size="small" onClick={allSelected ? onSelectNone : onSelectAll}>
                {allSelected ? text.selectNone : text.selectAll}
            </Button>
            {hasActions && (
                <TooltipIconButton
                    label={text.selectionActions}
                    disabled={count === 0}
                    onClick={(event) => onMenu(event.currentTarget)}
                >
                    <Icon name="more" fontSize="small" />
                </TooltipIconButton>
            )}
        </Box>
    );
};

export default SelectionBar;
