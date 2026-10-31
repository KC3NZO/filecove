import { memo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { TILE_LAYOUTS } from "../../styles/media-layout";
import {
    focusOutline,
    forcedColors,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
    visuallyHiddenSx,
} from "../../styles/mixins";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import { HoldBar, HoldLine } from "./asset-hold";
import OpenButton from "./open-button";

import type { AssetHold, FileAdapter, FileEntry } from "../../types";

/** The kinds a library shows as tiles; audio has rows (`MediaRow`). */
export type TileKind = keyof typeof TILE_LAYOUTS;

interface MediaTileProps {
    entry: FileEntry;
    kind: TileKind;
    adapter: FileAdapter;
    /** Where the entry is shown, from 0. */
    index: number;
    selected: boolean;
    /**
     * Why it can't be chosen now, shown in place of its size, with a bar while it's processed: it
     * isn't selected then, but is opened.
     */
    hold: AssetHold | undefined;
    /** Whether the tile has the grid's Tab stop. */
    focused: boolean;
    onPress: (index: number, event: MouseEvent) => void;
    /** A double click, which chooses it, or opens it while nothing is chosen. */
    onActivate: (index: number) => void;
    /** Its button opening it in the library's place. */
    onOpen: (index: number) => void;
    onFocus: (index: number) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const tileSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    flexDirection: "column",
    gap: 0.75,
    minWidth: 0,
    p: 0.75,
    borderRadius: 3,
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
    "&:hover": { bgcolor: hoverBackground(theme) },
    '&[aria-selected="true"]': { bgcolor: selectedBackground(theme) },
    '&[aria-selected="true"]:hover': { bgcolor: selectedHoverBackground(theme) },
    "&:focus-visible": focusOutline,
    '&[aria-disabled="true"]': { cursor: "default" },
    [forcedColors]: { '&[aria-selected="true"]': { bgcolor: "Highlight", color: "HighlightText" } },
});

// The picture, or the file's icon, in a box the tile's width and the kind's shape, its own corners
// rounded within the tile's. A selected tile rings it in `primary`, so a picture filling it still
// shows the selection.
const frameSx = (ratio: string): SxProps<Theme> => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: ratio,
    borderRadius: 2,
    overflow: "hidden",
    bgcolor: "action.hover",
    "[aria-selected='true'] > &": {
        outline: "3px solid",
        outlineColor: "primary.main",
        outlineOffset: "-3px",
    },
    // An asset that can't be chosen now is faded, as a file being uploaded is.
    "[data-held='true'] > & > img, [data-held='true'] > & > svg": { opacity: 0.55 },
    [forcedColors]: { "[aria-selected='true'] > &": { outlineColor: "HighlightText" } },
});

const FRAME_SX: Record<TileKind, SxProps<Theme>> = {
    image: frameSx(TILE_LAYOUTS.image.ratio),
    video: frameSx(TILE_LAYOUTS.video.ratio),
    document: frameSx(TILE_LAYOUTS.document.ratio),
};

const pictureSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    // A page shows from its top, where its title is.
    '[data-kind="document"] &': { objectPosition: "top" },
};

// The check at the frame's top end corner, shown on a selected tile.
const checkSx: SxProps<Theme> = {
    position: "absolute",
    top: 6,
    insetInlineEnd: 6,
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    bgcolor: "primary.main",
    color: "primary.contrastText",
    boxShadow: 1,
    "& > svg": { fontSize: 16 },
    "[aria-selected='true'] > * > &": { display: "flex" },
    [forcedColors]: { bgcolor: "Highlight", color: "HighlightText", outline: "1px solid HighlightText" },
};

// The button opening the asset, at the frame's top start corner, on the panel's own surface, shown
// as the pointer is over the tile or the focus is on it, and always on a touch screen.
const openSx: SxProps<Theme> = {
    position: "absolute",
    top: 4,
    insetInlineStart: 4,
    width: 28,
    height: 28,
    bgcolor: "background.paper",
    boxShadow: 1,
    opacity: 0,
    "& svg": { fontSize: 18 },
    "&:hover": { bgcolor: "background.paper" },
    "[role='option']:hover &, [role='option']:focus-visible &": { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    [forcedColors]: { opacity: 1, outline: "1px solid CanvasText" },
};

// A video's length, when the listing says it, at the frame's bottom start corner, on the panel's
// own surface, so it reads over any picture.
const badgeSx: SxProps<Theme> = {
    position: "absolute",
    bottom: 6,
    insetInlineStart: 6,
    display: "flex",
    alignItems: "center",
    gap: 0.25,
    px: 0.5,
    borderRadius: 1,
    bgcolor: "background.paper",
    color: "text.primary",
    boxShadow: 1,
    fontSize: "0.6875rem",
    fontWeight: 600,
    lineHeight: "18px",
    "& > svg": { fontSize: 14 },
    [forcedColors]: { bgcolor: "Canvas", color: "CanvasText", outline: "1px solid CanvasText" },
};

const textSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    px: 0.25,
    textAlign: "center",
};

const nameSx: SxProps<Theme> = {
    fontSize: "0.8125rem",
};

const detailSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

/**
 * One asset of a library shown as tiles: its picture or icon in the kind's shape, with a video's
 * length over it, and its name, with a picture's or a video's size, or a document's, under it.
 */
const MediaTile = memo(
    ({
        entry,
        kind,
        adapter,
        index,
        selected,
        hold,
        focused,
        onPress,
        onActivate,
        onOpen,
        onFocus,
        onKeyDown,
    }: MediaTileProps) => {
        const { formatDuration, formatNumber, formatSize, text } = useLocale();
        const thumbnail = useThumbnail(entry, adapter, "grid", TILE_LAYOUTS[kind].thumbnail);
        const duration = kind === "video" ? entry.media?.duration : undefined;
        const { width, height } = entry.media ?? {};
        const measured = kind !== "document" && width !== undefined && height !== undefined;

        return (
            <Box
                role="option"
                aria-selected={selected}
                // One selected before it was held, as an upload still processed is, can be taken out.
                aria-disabled={hold && !selected ? true : undefined}
                tabIndex={focused ? 0 : -1}
                data-index={index}
                data-kind={kind}
                data-held={!!hold}
                sx={tileSx}
                onClick={(event) => onPress(index, event)}
                onDoubleClick={() => onActivate(index)}
                onFocus={() => onFocus(index)}
                onKeyDown={onKeyDown}
            >
                <Box sx={FRAME_SX[kind]}>
                    {thumbnail ? (
                        <Box component="img" src={thumbnail} alt="" draggable={false} sx={pictureSx} />
                    ) : (
                        <FileTypeIcon fileName={entry.name} size={kind === "video" ? "30%" : "42%"} />
                    )}
                    {duration !== undefined && (
                        <Box component="span" sx={badgeSx} aria-hidden>
                            <Icon name="videos" />
                            <bdi>{formatDuration(duration)}</bdi>
                        </Box>
                    )}
                    <Box component="span" sx={checkSx} aria-hidden>
                        <Icon name="check" />
                    </Box>
                    <OpenButton name={entry.name} index={index} onOpen={onOpen} sx={openSx} />
                    {hold && <HoldBar hold={hold} place="frame" />}
                </Box>
                <Box sx={textSx}>
                    <Typography variant="body2" noWrap sx={nameSx}>
                        {entry.name}
                    </Typography>
                    {hold ? (
                        <HoldLine hold={hold} />
                    ) : measured ? (
                        <Typography variant="caption" noWrap sx={detailSx} aria-hidden>
                            <bdi>{`${formatNumber(width)} × ${formatNumber(height)}`}</bdi>
                        </Typography>
                    ) : (
                        kind === "document" &&
                        entry.size !== undefined && (
                            <Typography variant="caption" noWrap sx={detailSx}>
                                <bdi>{formatSize(entry.size)}</bdi>
                            </Typography>
                        )
                    )}
                </Box>
                {measured && (
                    <Box component="span" sx={visuallyHiddenSx}>
                        {text.mediaDimensions(formatNumber(width), formatNumber(height))}
                    </Box>
                )}
                {duration !== undefined && (
                    <Box component="span" sx={visuallyHiddenSx}>
                        {text.mediaDuration(formatDuration(duration))}
                    </Box>
                )}
            </Box>
        );
    },
);

export default MediaTile;
