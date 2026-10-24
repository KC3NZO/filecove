import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import Icon from "../../icons/icon";

// Fills the scrolling view, as a folder's empty state does.
const stateSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    boxSizing: "border-box",
    minHeight: "100%",
    p: 3,
    textAlign: "center",
    color: "text.secondary",
};

const stateIconSx: SxProps<Theme> = {
    fontSize: "3rem",
    opacity: 0.6,
};

const stateTitleSx: SxProps<Theme> = {
    color: "text.primary",
    fontWeight: 600,
};

/**
 * The content while the file manager has no section to show, as while an app is still getting its
 * sections, in place of an empty panel.
 */
const NoSections = () => {
    const { text } = useLocale();

    return (
        <Box sx={stateSx}>
            <Icon name="folder" sx={stateIconSx} />
            <Typography sx={stateTitleSx}>{text.noSections}</Typography>
        </Box>
    );
};

export default NoSections;
