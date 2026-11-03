import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { focusOutline, selectedBackground } from "../../styles/mixins";

interface DropZoneProps {
    /** What a drop does. */
    label: string;
}

// An outline inside the library's edge, and what a drop does, in its middle.
const rootSx: SxProps<Theme> = (theme) => ({
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    p: 3,
    borderRadius: "inherit",
    bgcolor: selectedBackground(theme),
    pointerEvents: "none",
    ...focusOutline,
});

const labelSx: SxProps<Theme> = {
    px: 2,
    py: 1,
    borderRadius: 2,
    bgcolor: "background.paper",
    boxShadow: 2,
    fontSize: "0.875rem",
    fontWeight: 600,
    textAlign: "center",
};

/** Over a library while files dragged over it can be dropped there. */
const DropZone = ({ label }: DropZoneProps) => (
    <Box sx={rootSx}>
        <Typography sx={labelSx}>{label}</Typography>
    </Box>
);

export default DropZone;
