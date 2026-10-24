import { useContext } from "react";
import type { CSSProperties, Ref } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../contexts/direction-context";
import { useLocale } from "../../hooks/use-locale";
import Icon from "../icons/icon";
import ItemIcon from "./content/item-icon";

import type { DropEffect, FileEntry } from "../../types";

interface DragPreviewProps {
    ref: Ref<HTMLDivElement>;
    /** The entry the drag started from. */
    entry: FileEntry;
    /** How many entries are dragged, that one included. */
    count: number;
    /**
     * A touch drag's, which follows the finger (`useEntryDrag` places it) and shows what letting
     * go would do, where a mouse drag has the cursor say it.
     */
    touch?: boolean;
    effect?: DropEffect;
}

/** Most cards in the stack, the grabbed entry's included, however many entries are dragged. */
const MAX_LAYERS = 5;

// At the page's top corner rather than off screen, since Safari cancels a drag whose image is
// wholly off screen; it's gone before the page is painted. The pointer holds it by its top corner
// on the start side (`useEntryDrag`), the left or, right to left, the right. The transparent
// padding there keeps the pointer just outside the picture, off the folder it's dropped onto, and
// on the other sides makes room for the deepest card, so the whole stack is inside the element the
// picture is taken of.
const rootSx: SxProps<Theme> = {
    position: "fixed",
    top: 0,
    insetInlineStart: 0,
    pt: 1.5,
    paddingInlineStart: 1.5,
    paddingInlineEnd: 2,
    pb: 2,
    pointerEvents: "none",
};

// A touch drag's follows the finger, placed by `useEntryDrag` through its `transform` from the
// viewport's top left, physical as measured geometry is (`TOUCH_STYLE`), over the dialogs and
// tooltips, and hidden until it's first placed. It fades where letting go would do nothing.
const touchRootSx: SxProps<Theme> = (theme) => ({
    position: "fixed",
    top: 0,
    zIndex: theme.zIndex.tooltip + 1,
    pt: 1.5,
    paddingInlineStart: 1.5,
    paddingInlineEnd: 2,
    pb: 2,
    pointerEvents: "none",
    visibility: "hidden",
    transition: "opacity 120ms",
    '&[data-effect="none"]': { opacity: 0.5 },
});

const TOUCH_STYLE: CSSProperties = { left: 0 };

const stackSx: SxProps<Theme> = {
    position: "relative",
};

// A card under the top one, the size of it, shifted down and towards the end by 4px per `--layer`
// and fading the deeper it is.
const layerSx: SxProps<Theme> = {
    position: "absolute",
    top: "calc(var(--layer) * 4px)",
    insetInlineStart: "calc(var(--layer) * 4px)",
    insetInlineEnd: "calc(var(--layer) * -4px)",
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
    paddingInlineStart: 1,
    paddingInlineEnd: 1.25,
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

// A "+" where letting go would copy, as the Finder shows it.
const copySx: SxProps<Theme> = {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.25rem",
    height: "1.25rem",
    borderRadius: "50%",
    bgcolor: "success.main",
    color: "success.contrastText",
    "& > svg": { fontSize: "1rem" },
};

const layerStyle = (layer: number) => ({ "--layer": layer }) as CSSProperties;

/**
 * The drag image: the grabbed entry's icon and name on a card, stacked on a card for each other
 * entry up to `MAX_LAYERS`, with a count of them all when others go along, and for a touch drag a
 * "+" where letting go would copy.
 */
const DragPreview = ({ ref, entry, count, touch = false, effect = "move" }: DragPreviewProps) => {
    const { formatNumber } = useLocale();
    const dir = useContext(DirectionContext);
    // Deepest first, so each card paints over the one below it.
    const depth = Math.min(count, MAX_LAYERS) - 1;
    const layers = Array.from({ length: depth }, (_, index) => depth - index).map((layer) => (
        <Box key={layer} sx={layerSx} style={layerStyle(layer)} />
    ));

    return (
        <Box
            ref={ref}
            sx={touch ? touchRootSx : rootSx}
            style={touch ? TOUCH_STYLE : undefined}
            dir={dir}
            data-effect={touch ? effect : undefined}
            aria-hidden
        >
            <Box sx={stackSx}>
                {layers}
                <Box sx={pillSx}>
                    <ItemIcon entry={entry} size={1.25} />
                    <Typography variant="body2" noWrap sx={nameSx}>
                        <bdi>{entry.name}</bdi>
                    </Typography>
                    {count > 1 && <Box sx={countSx}>{formatNumber(count)}</Box>}
                    {touch && effect === "copy" && (
                        <Box component="span" sx={copySx}>
                            <Icon name="add" />
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default DragPreview;
