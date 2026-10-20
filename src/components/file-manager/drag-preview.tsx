import type { CSSProperties, Ref } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import ItemIcon from "./content/item-icon";

import type { FileEntry } from "../../types";

interface DragPreviewProps {
    ref: Ref<HTMLDivElement>;
    /** The entry the drag started from. */
    entry: FileEntry;
    /** How many entries are dragged, that one included. */
    count: number;
}

/** Most cards in the stack, the grabbed entry's included, however many entries are dragged. */
const MAX_LAYERS = 5;

// At the page's top left rather than off screen, since Safari cancels a drag whose image is wholly
// off screen; it's gone before the page is painted. The transparent padding keeps the pointer
// just outside the picture, off the folder it's dropped onto, and on the other sides makes room
// for the deepest card, so the whole stack is inside the element the picture is taken of.
const rootSx: SxProps<Theme> = {
    position: "fixed",
    top: 0,
    left: 0,
    pt: 1.5,
    pl: 1.5,
    pr: 2,
    pb: 2,
    pointerEvents: "none",
};

const stackSx: SxProps<Theme> = {
    position: "relative",
};

// A card under the top one, the size of it, shifted down and right by 4px per `--layer` and
// fading the deeper it is.
const layerSx: SxProps<Theme> = {
    position: "absolute",
    top: "calc(var(--layer) * 4px)",
    left: "calc(var(--layer) * 4px)",
    right: "calc(var(--layer) * -4px)",
    bottom: "calc(var(--layer) * -4px)",
    opacity: "calc(1 - var(--layer) * 0.15)",
    borderRadius: 2,
    border: 1,
    borderColor: "divider",
    bgcolor: "background.paper",
};

// Positioned so it paints over the cards before it.
const pillSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 1,
    maxWidth: "16rem",
    py: 0.75,
    pl: 1,
    pr: 1.25,
    borderRadius: 2,
    border: 1,
    borderColor: "divider",
    bgcolor: "background.paper",
    color: "text.primary",
};

const nameSx: SxProps<Theme> = {
    minWidth: 0,
};

const countSx: SxProps<Theme> = {
    flexShrink: 0,
    minWidth: "1.25rem",
    height: "1.25rem",
    px: 0.5,
    borderRadius: "0.625rem",
    bgcolor: "primary.main",
    color: "primary.contrastText",
    fontSize: "0.75rem",
    fontWeight: 600,
    lineHeight: "1.25rem",
    textAlign: "center",
};

const layerStyle = (layer: number) => ({ "--layer": layer }) as CSSProperties;

/**
 * The drag image: the grabbed entry's icon and name on a card, stacked on a card for each other
 * entry up to `MAX_LAYERS`, with a count of them all when others go along.
 */
const DragPreview = ({ ref, entry, count }: DragPreviewProps) => {
    // Deepest first, so each card paints over the one below it.
    const depth = Math.min(count, MAX_LAYERS) - 1;
    const layers = Array.from({ length: depth }, (_, index) => depth - index).map((layer) => (
        <Box key={layer} sx={layerSx} style={layerStyle(layer)} />
    ));

    return (
        <Box ref={ref} sx={rootSx} aria-hidden>
            <Box sx={stackSx}>
                {layers}
                <Box sx={pillSx}>
                    <ItemIcon entry={entry} size="1.25rem" />
                    <Typography variant="body2" noWrap sx={nameSx}>
                        {entry.name}
                    </Typography>
                    {count > 1 && <Box sx={countSx}>{count}</Box>}
                </Box>
            </Box>
        </Box>
    );
};

export default DragPreview;
