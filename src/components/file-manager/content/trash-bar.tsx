import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import Icon from "../../icons/icon";

import type { Section } from "../../../types";

interface TrashBarProps {
    /** The trash, whose root is open. */
    section: Section;
    /** Asks to confirm emptying the trash; missing when its adapter can't delete. */
    onEmpty?: () => void;
}

// Above the scrolling view, so it never scrolls away, along the content panel's top, as Finder's
// and GNOME's trash bars are. The button keeps its line, and the text wraps beside it.
const barSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    flexShrink: 0,
    minHeight: 48,
    px: 2,
    py: 0.75,
    borderBottom: 1,
    borderColor: "divider",
    color: "text.secondary",
};

const iconSx: SxProps<Theme> = {
    flexShrink: 0,
};

const hintSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
};

const buttonSx: SxProps<Theme> = {
    flexShrink: 0,
    whiteSpace: "nowrap",
};

/**
 * Says what the trash is for, with its own button emptying it, disabled while its listing is empty,
 * hidden entries counting, as they go with it.
 */
const TrashBar = ({ section, onEmpty }: TrashBarProps) => {
    const { text } = useLocale();
    // The open folder's view lists it; the bar only reads it.
    const { state } = useFolder(section, section.rootId, false);
    const empty = state?.status === "ready" && !state.partial && state.entries?.length === 0;

    return (
        <Box sx={barSx}>
            <Icon name="delete" fontSize="small" sx={iconSx} />
            <Typography variant="body2" sx={hintSx}>
                {text.trashHint}
            </Typography>
            {onEmpty && (
                <Button size="small" color="error" disabled={empty} sx={buttonSx} onClick={onEmpty}>
                    {text.trashEmptyButton}
                </Button>
            )}
        </Box>
    );
};

export default TrashBar;
