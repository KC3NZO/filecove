import { useId } from "react";
import type { Ref } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { mediaWide } from "../../styles/media-layout";
import Icon from "../icons/icon";

interface ChooseBarProps {
    /** How many are selected, in every library. */
    count: number;
    /** What holds Choose back, said beside it, while picks can't be chosen; nothing otherwise. */
    held: string | undefined;
    /** Whether the selected column is open over the library. */
    chosenOpen: boolean;
    /** Whether there's a column to open: not one at a time with nothing selected. */
    showOpener: boolean;
    /** The button opening the selected column, which takes the focus back as it closes. */
    openerRef: Ref<HTMLButtonElement>;
    onOpenChosen: () => void;
    onChoose: () => void;
}

// Only where the selected column doesn't dock; beside it, the column has its own Choose.
const barSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flexShrink: 0,
    minHeight: 52,
    px: 1.5,
    [mediaWide]: { display: "none" },
};

const openSx: SxProps<Theme> = {
    marginInlineEnd: "auto",
};

// Beside Choose, giving way first where there's little room.
const heldSx: SxProps<Theme> = {
    flexShrink: 1,
    minWidth: 0,
    color: "text.secondary",
    fontSize: "0.75rem",
};

/**
 * Under the library, where there's no room to dock the selected column: a button opening it over
 * the library, with how many are selected, and Choose.
 */
const ChooseBar = ({ count, held, chosenOpen, showOpener, openerRef, onOpenChosen, onChoose }: ChooseBarProps) => {
    const { text } = useLocale();
    const heldId = useId();

    return (
        <Box sx={barSx}>
            {showOpener ? (
                <Button
                    ref={openerRef}
                    color="inherit"
                    aria-expanded={chosenOpen}
                    endIcon={<Icon name="expand" fontSize="small" />}
                    sx={openSx}
                    onClick={onOpenChosen}
                >
                    {count > 0 ? text.mediaSelected(count) : text.mediaChosen}
                </Button>
            ) : (
                <Box sx={openSx} />
            )}
            {held && (
                <Typography id={heldId} variant="body2" noWrap title={held} sx={heldSx}>
                    {held}
                </Typography>
            )}
            <Button
                variant="contained"
                disableElevation
                disabled={count === 0 || !!held}
                aria-describedby={held ? heldId : undefined}
                onClick={onChoose}
            >
                {text.mediaChoose}
            </Button>
        </Box>
    );
};

export default ChooseBar;
