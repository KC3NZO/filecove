import type { CSSProperties } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { FolderTypeIcon, Icon } from "../../icons";
import { focusRing, selectedBackground } from "../styles";

import type { LocationNode } from "../types";

interface LocationItemProps {
    node: LocationNode;
    /** 0 for a top-level place, 1 and up for folders in its tree. */
    depth: number;
    selected: string | undefined;
    expanded: ReadonlySet<string>;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
}

/*
 * Tree geometry, in px. Each `<li>` sets `--depth`, and every offset below is derived from it.
 * A level's guide line runs through the centre of its parent's chevron, or through the place
 * icon for the first level, so the tree visibly hangs from the place it belongs to.
 */
const INSET = 12;
const INDENT = 16;
const CHEVRON = 20;

const indent = (extra: number) => `calc(${INSET + extra}px + var(--depth) * ${INDENT}px)`;

const itemSx: SxProps<Theme> = {
    listStyle: "none",
};

const rowSx: SxProps<Theme> = (theme) => ({
    position: "relative",
    borderRadius: 2,
    color: "text.primary",
    "&:hover": { bgcolor: "action.hover" },
    '&[data-selected="true"]': {
        bgcolor: selectedBackground(theme),
        color: "primary.main",
    },
});

const placeButtonSx: SxProps<Theme> = {
    width: "100%",
    minHeight: 36,
    justifyContent: "flex-start",
    gap: 1.5,
    pl: `${INSET}px`,
    // Room for the expand toggle on the right.
    pr: 4.5,
    borderRadius: "inherit",
    ...focusRing,
};

const nodeButtonSx: SxProps<Theme> = {
    width: "100%",
    minHeight: 30,
    justifyContent: "flex-start",
    gap: 1,
    pl: indent(CHEVRON + 4),
    pr: 1,
    borderRadius: "inherit",
    "& > svg": { flexShrink: 0 },
    ...focusRing,
};

const placeLabelSx: SxProps<Theme> = {
    minWidth: 0,
    fontSize: "0.875rem",
};

const nodeLabelSx: SxProps<Theme> = {
    minWidth: 0,
    fontSize: "0.8125rem",
};

// Places keep the plain GNOME look, so their toggle only shows on hover, on keyboard focus,
// while expanded, or always on touch screens where there is no hover.
const placeToggleSx: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    right: 6,
    width: 24,
    height: 24,
    transform: "translateY(-50%)",
    borderRadius: 1,
    color: "text.secondary",
    opacity: 0,
    transition: "opacity 120ms",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
    '*:hover > &, &.Mui-focusVisible, &[aria-expanded="true"]': { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    "& > svg": { fontSize: "1.125rem", transition: "transform 150ms" },
    '&[aria-expanded="true"] > svg': { transform: "rotate(90deg)" },
    ...focusRing,
};

const nodeToggleSx: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    left: indent(0),
    width: CHEVRON,
    height: CHEVRON,
    transform: "translateY(-50%)",
    borderRadius: 1,
    color: "text.secondary",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
    "& > svg": { fontSize: "1rem", transition: "transform 150ms" },
    '&[aria-expanded="true"] > svg': { transform: "rotate(90deg)" },
    ...focusRing,
};

const childListSx: SxProps<Theme> = {
    position: "relative",
    m: 0,
    px: 0,
    py: 0.25,
    "&::before": {
        content: '""',
        position: "absolute",
        top: 2,
        bottom: 2,
        left: indent(CHEVRON / 2),
        width: "1px",
        bgcolor: "divider",
    },
};

const LocationItem = ({ node, depth, selected, expanded, onSelect, onToggle }: LocationItemProps) => {
    const isPlace = depth === 0;
    const isSelected = selected === node.id;
    const hasChildren = !!node.children?.length;
    const isExpanded = hasChildren && expanded.has(node.id);

    const toggle = hasChildren && (
        <ButtonBase
            sx={isPlace ? placeToggleSx : nodeToggleSx}
            aria-label={`${node.label} folders`}
            aria-expanded={isExpanded}
            onClick={() => onToggle(node.id)}
        >
            <Icon name="chevronRight" />
        </ButtonBase>
    );

    return (
        <Box component="li" sx={itemSx} style={{ "--depth": depth } as CSSProperties}>
            <Box sx={rowSx} data-selected={isSelected}>
                <ButtonBase
                    sx={isPlace ? placeButtonSx : nodeButtonSx}
                    aria-current={isSelected ? "page" : undefined}
                    onClick={() => onSelect(node.id)}
                >
                    {node.icon ? (
                        <Icon name={node.icon} fontSize="small" />
                    ) : (
                        <FolderTypeIcon folderName={node.label} size={isPlace ? "1.25rem" : "1.125rem"} />
                    )}
                    <Typography component="span" noWrap sx={isPlace ? placeLabelSx : nodeLabelSx}>
                        {node.label}
                    </Typography>
                </ButtonBase>
                {toggle}
            </Box>
            {hasChildren && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box component="ul" sx={childListSx}>
                        {node.children?.map((child) => (
                            <LocationItem
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                selected={selected}
                                expanded={expanded}
                                onSelect={onSelect}
                                onToggle={onToggle}
                            />
                        ))}
                    </Box>
                </Collapse>
            )}
        </Box>
    );
};

export default LocationItem;
