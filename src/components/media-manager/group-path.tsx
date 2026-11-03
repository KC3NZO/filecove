import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { focusRing } from "../../styles/mixins";
import Icon from "../icons/icon";

import type { FileEntry } from "../../types";

interface GroupPathProps {
    /** The library's name, where the path starts. */
    label: string;
    /** The groups gone into from its root, to the one open. */
    trail: readonly FileEntry[];
    /** Goes to the level with that many groups of the trail open. */
    onGoToLevel: (depth: number) => void;
}

const pathSx: SxProps<Theme> = {
    display: "flex",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
};

const listSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    m: 0,
    p: 0,
    listStyle: "none",
};

// Those before the one open give way long before it does, a few letters of each staying.
const itemSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    flex: "0 100 auto",
    minWidth: "3.5rem",
    "&:last-of-type": { flex: "0 1 auto", minWidth: 0 },
};

const crumbSx: SxProps<Theme> = {
    display: "block",
    minWidth: 0,
    height: 28,
    px: 1,
    borderRadius: 1.5,
    color: "text.secondary",
    fontSize: "0.875rem",
    lineHeight: "28px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
    ...focusRing,
};

const currentSx: SxProps<Theme> = {
    minWidth: 0,
    px: 1,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const separatorSx: SxProps<Theme> = {
    flexShrink: 0,
    fontSize: "1rem",
    color: "text.disabled",
};

/**
 * Where the group open is, as it was walked to, as it's only ever listed a level at a time: the
 * library's name and the groups on the way, each going back there, and the one open, which names
 * what's shown.
 */
const GroupPath = ({ label, trail, onGoToLevel }: GroupPathProps) => {
    const { text } = useLocale();
    const before = [label, ...trail.slice(0, -1).map(({ name }) => name)];

    return (
        <Box component="nav" aria-label={text.mediaGroupPath} sx={pathSx}>
            <Box component="ol" sx={listSx}>
                {before.map((name, depth) => (
                    <Box component="li" key={trail[depth - 1]?.id ?? ""} sx={itemSx}>
                        <ButtonBase title={name} sx={crumbSx} onClick={() => onGoToLevel(depth)}>
                            <bdi>{name}</bdi>
                        </ButtonBase>
                        <Icon name="chevronRight" sx={separatorSx} aria-hidden />
                    </Box>
                ))}
                <Box component="li" sx={itemSx}>
                    <Typography component="h2" noWrap aria-current="page" sx={currentSx}>
                        <bdi>{trail.at(-1)?.name}</bdi>
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default GroupPath;
