import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import Icon from "./icon";

import type { IconSource } from "../../types";

interface IconSlotProps {
    icon: IconSource;
}

// Consumer-supplied elements are fitted to the same 1.25rem box as the built-in icons.
const slotSx: SxProps<Theme> = {
    display: "inline-flex",
    flexShrink: 0,
    width: "1.25rem",
    height: "1.25rem",
    "& > svg": { width: "100%", height: "100%" },
};

const IconSlot = ({ icon }: IconSlotProps) => (
    <Box component="span" sx={slotSx}>
        {typeof icon === "string" ? <Icon name={icon} /> : icon}
    </Box>
);

export default IconSlot;
