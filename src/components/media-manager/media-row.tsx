import { memo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { AUDIO_ROW } from "../../styles/media-layout";
import {
    focusOutline,
    forcedColors,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
    visuallyHiddenSx,
} from "../../styles/mixins";
import { joinIsolated } from "../../utils/bidi";
import Icon from "../icons/icon";
import OpenButton from "./open-button";

import type { FileAdapter, FileEntry } from "../../types";

interface MediaRowProps {
    entry: FileEntry;
    adapter: FileAdapter;
    /** Where the entry is shown, from 0. */
    index: number;
    selected: boolean;
    /** Whether the row has the list's Tab stop. */
    focused: boolean;
    onPress: (index: number, event: MouseEvent) => void;
    /** A double click, which chooses it, or opens it while nothing is chosen. */
    onActivate: (index: number) => void;
    /** Its button opening it in the library's place. */
    onOpen: (index: number) => void;
    onFocus: (index: number) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const rowSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minWidth: 0,
    px: 1,
    py: 0.75,
    borderRadius: 2,
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
    "&:hover": { bgcolor: hoverBackground(theme) },
    '&[aria-selected="true"]': { bgcolor: selectedBackground(theme) },
    '&[aria-selected="true"]:hover': { bgcolor: selectedHoverBackground(theme) },
    "&:focus-visible": focusOutline,
    [forcedColors]: { '&[aria-selected="true"]': { bgcolor: "Highlight", color: "HighlightText" } },
});

// Its cover, when the adapter has a thumbnail for it, or the music icon, in a rounded square.
const coverSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: `${AUDIO_ROW}rem`,
    height: `${AUDIO_ROW}rem`,
    borderRadius: 1.5,
    overflow: "hidden",
    bgcolor: "action.hover",
    color: "text.secondary",
    "& > img": { width: "100%", height: "100%", objectFit: "cover" },
};

const textSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
};

const detailSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

const durationSx: SxProps<Theme> = {
    flexShrink: 0,
    color: "text.secondary",
    fontSize: "0.8125rem",
    fontVariantNumeric: "tabular-nums",
};

// The button opening it, before the check, shown as the pointer is over the row or the focus is on
// it, and always on a touch screen.
const openSx: SxProps<Theme> = {
    flexShrink: 0,
    opacity: 0,
    "& svg": { fontSize: 18 },
    "[role='option']:hover > &, [role='option']:focus-visible > &": { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    [forcedColors]: { opacity: 1 },
};

// The check at the row's end, shown while it's selected.
const checkSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: "50%",
    bgcolor: "primary.main",
    color: "primary.contrastText",
    visibility: "hidden",
    "& > svg": { fontSize: 16 },
    "[aria-selected='true'] > &": { visibility: "visible" },
    [forcedColors]: { bgcolor: "Highlight", color: "HighlightText", outline: "1px solid HighlightText" },
};

/** One piece of audio of a library: its cover or icon, its name, its type and size, and its length. */
const MediaRow = memo(
    ({ entry, adapter, index, selected, focused, onPress, onActivate, onOpen, onFocus, onKeyDown }: MediaRowProps) => {
        const { describeType, formatDuration, formatSize, text } = useLocale();
        const cover = useThumbnail(entry, adapter, "list", AUDIO_ROW);
        const duration = entry.media?.duration;
        const detail = [describeType(entry), ...(entry.size !== undefined ? [formatSize(entry.size)] : [])];

        return (
            <Box
                role="option"
                aria-selected={selected}
                tabIndex={focused ? 0 : -1}
                data-index={index}
                sx={rowSx}
                onClick={(event) => onPress(index, event)}
                onDoubleClick={() => onActivate(index)}
                onFocus={() => onFocus(index)}
                onKeyDown={onKeyDown}
            >
                <Box sx={coverSx}>
                    {cover ? <img src={cover} alt="" draggable={false} /> : <Icon name="music" />}
                </Box>
                <Box sx={textSx}>
                    <Typography variant="body2" noWrap>
                        {entry.name}
                    </Typography>
                    <Typography variant="caption" noWrap sx={detailSx}>
                        {joinIsolated(detail)}
                    </Typography>
                </Box>
                {duration !== undefined && (
                    <>
                        <Box component="span" sx={durationSx} aria-hidden>
                            <bdi>{formatDuration(duration)}</bdi>
                        </Box>
                        <Box component="span" sx={visuallyHiddenSx}>
                            {text.mediaDuration(formatDuration(duration))}
                        </Box>
                    </>
                )}
                <OpenButton name={entry.name} index={index} onOpen={onOpen} sx={openSx} />
                <Box component="span" sx={checkSx} aria-hidden>
                    <Icon name="check" />
                </Box>
            </Box>
        );
    },
);

export default MediaRow;
