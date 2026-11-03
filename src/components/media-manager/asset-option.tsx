import { memo, useCallback, useId, useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { AssetLookContext } from "../../contexts/asset-look-context";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { ROW_PICTURE, TILE_LAYOUTS } from "../../styles/media-layout";
import {
    focusOutline,
    forcedColors,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
} from "../../styles/mixins";
import Icon from "../icons/icon";
import { HoldBar, HoldLine } from "./asset-hold";
import MediaRow from "./media-row";
import MediaTile from "./media-tile";
import OpenButton from "./open-button";

import type { AssetHold, FileAdapter, FileEntry, MediaAssetDraw, MediaKind, MediaLayout } from "../../types";

interface AssetOptionProps {
    entry: FileEntry;
    kind: MediaKind;
    /** What it's shown as: a tile of the kind's shape, or a row. */
    layout: MediaLayout;
    adapter: FileAdapter;
    /** Where the entry is shown, from 0. */
    index: number;
    selected: boolean;
    /** Why it can't be chosen now: it isn't selected then, but is opened. */
    hold: AssetHold | undefined;
    /** The backend's work on it while it can be chosen all the same, shown the same way, unfaded. */
    work: AssetHold | undefined;
    /** Whether there's no room for it among those selected (`maxChoices`): dimmed, with nothing said on it. */
    limited: boolean;
    /** Whether it has the grid's Tab stop. */
    focused: boolean;
    /** What the app draws it with, the library's `renderAsset` or the media manager's. */
    draw: MediaAssetDraw | undefined;
    /** What the app draws it with when it's a group, the library's `renderGroup` or the media manager's. */
    drawGroup: MediaAssetDraw | undefined;
    /** Whether a group has details to open, which puts the Open button on it. */
    opensGroups: boolean;
    /** Whether an asset has a view to open, which puts the Open button on it. */
    opensAssets: boolean;
    onPress: (index: number, event: MouseEvent) => void;
    /** A double click, which chooses it, or opens it while nothing is chosen. */
    onActivate: (index: number) => void;
    /** Its button opening it in the library's place. */
    onOpen: (index: number) => void;
    onFocus: (index: number) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

interface AssetBodyProps {
    draw: MediaAssetDraw;
    params: Parameters<MediaAssetDraw>[0];
}

// The room between a tile's edge and what's in it, which the check and the Open button go by.
const TILE_PADDING = 0.75;

const TILE_SX: SxProps<Theme> = (theme) => ({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    p: TILE_PADDING,
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

const ROW_SX: SxProps<Theme> = (theme) => ({
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
    '&[aria-disabled="true"]': { cursor: "default" },
    [forcedColors]: { '&[aria-selected="true"]': { bgcolor: "Highlight", color: "HighlightText" } },
});

// What the app drew, and under it why it can't be chosen now, as nothing it drew says so.
const contentSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: 0.5,
    minWidth: 0,
    "[data-layout='tile'] > & > [data-status]": { textAlign: "center" },
};

// What the app drew entirely itself is faded as the media manager's own pictures are, which fade
// themselves, by the same marks.
const drawnSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    '[data-held="true"] > * > &[data-own="true"]': { opacity: 0.55 },
    '[data-limited="true"] > * > &[data-own="true"]': { opacity: 0.7 },
};

// The check at a tile's top end corner, over its picture's, shown while it's selected.
const tileCheckSx: SxProps<Theme> = {
    position: "absolute",
    top: (theme) => `calc(${theme.spacing(TILE_PADDING)} + 6px)`,
    insetInlineEnd: (theme) => `calc(${theme.spacing(TILE_PADDING)} + 6px)`,
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
    "[aria-selected='true'] > &": { display: "flex" },
    [forcedColors]: { bgcolor: "Highlight", color: "HighlightText", outline: "1px solid HighlightText" },
};

// The check at a row's end, shown while it's selected.
const rowCheckSx: SxProps<Theme> = {
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

// The button opening the asset, at a tile's top start corner, on the panel's own surface, shown as
// the pointer is over it or the focus is on it, and always on a touch screen.
const tileOpenSx: SxProps<Theme> = {
    position: "absolute",
    top: (theme) => `calc(${theme.spacing(TILE_PADDING)} + 4px)`,
    insetInlineStart: (theme) => `calc(${theme.spacing(TILE_PADDING)} + 4px)`,
    width: 28,
    height: 28,
    bgcolor: "background.paper",
    boxShadow: 1,
    opacity: 0,
    "& svg": { fontSize: 18 },
    "&:hover": { bgcolor: "background.paper" },
    "[role='option']:hover > &, [role='option']:focus-visible > &": { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    [forcedColors]: { opacity: 1, outline: "1px solid CanvasText" },
};

// The button opening it, before a row's check, shown the same way.
const rowOpenSx: SxProps<Theme> = {
    flexShrink: 0,
    opacity: 0,
    "& svg": { fontSize: 18 },
    "[role='option']:hover > &, [role='option']:focus-visible > &": { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    [forcedColors]: { opacity: 1 },
};

/**
 * What the app's `renderAsset` returns, drawn as a component of its own, so hooks in it belong to
 * this asset. Memoized, so finding out what it drew doesn't draw it again.
 */
const AssetBody = memo(({ draw, params }: AssetBodyProps): ReactNode => draw(params));

/**
 * One asset in the grid, or a group, as a tile or a row: what makes it one to select or to go into,
 * whoever draws it. The `option` with its keys, clicks and marks, the check and the Open button. Inside it,
 * the media manager's own look (`MediaTile`, `MediaRow`), or what the app's `renderAsset` returns.
 * An app may use the same looks there. When it has drawn something else entirely, this says why the
 * asset can't be chosen under it, fades it as those do, and names it, what the app drew being read
 * as its description, so no asset is left unnamed or held without a word.
 */
const AssetOption = memo(
    ({
        entry,
        kind,
        layout,
        adapter,
        index,
        selected,
        hold,
        work,
        limited,
        focused,
        draw,
        drawGroup,
        opensGroups,
        opensAssets,
        onPress,
        onActivate,
        onOpen,
        onFocus,
        onKeyDown,
    }: AssetOptionProps) => {
        const row = layout === "list";
        const group = entry.kind === "folder";
        const drawn = group ? drawGroup : draw;
        const thumbnail = useThumbnail(
            entry,
            adapter,
            layout,
            row ? ROW_PICTURE : TILE_LAYOUTS[kind].thumbnail,
            true,
        );
        const standing = hold ?? work;
        const contentId = useId();
        // How many of the media manager's own looks are drawn in what the app returned, told before
        // anything is painted.
        const [looks, setLooks] = useState(0);
        const claim = useCallback(() => {
            setLooks((count) => count + 1);

            return () => setLooks((count) => count - 1);
        }, []);
        // Whether the app has drawn this entirely itself.
        const own = !!drawn && looks === 0;
        const params = useMemo(
            () => ({ asset: entry, kind, layout, adapter, thumbnail, selected, hold: standing }),
            [entry, kind, layout, adapter, thumbnail, selected, standing],
        );
        const Look = row ? MediaRow : MediaTile;

        return (
            <Box
                role="option"
                // A group isn't one to select, which an `option` says by having none of this.
                aria-selected={group ? undefined : selected}
                // One selected before it was held, as an upload still processed is, can be taken out.
                aria-disabled={(hold && !selected) || limited ? true : undefined}
                aria-label={own ? entry.name : undefined}
                aria-describedby={own ? contentId : undefined}
                tabIndex={focused ? 0 : -1}
                data-index={index}
                data-layout={row ? "row" : "tile"}
                data-held={!!hold}
                data-limited={limited}
                sx={row ? ROW_SX : TILE_SX}
                onClick={(event) => onPress(index, event)}
                onDoubleClick={() => onActivate(index)}
                onFocus={() => onFocus(index)}
                onKeyDown={onKeyDown}
            >
                {drawn ? (
                    <Box id={contentId} sx={contentSx}>
                        <Box data-own={own} sx={drawnSx}>
                            <AssetLookContext value={claim}>
                                <AssetBody draw={drawn} params={params} />
                            </AssetLookContext>
                        </Box>
                        {own && standing && (
                            <>
                                <HoldLine hold={standing} />
                                <HoldBar hold={standing} place="row" />
                            </>
                        )}
                    </Box>
                ) : (
                    <Look asset={entry} kind={kind} thumbnail={thumbnail} hold={standing} />
                )}
                {(group ? opensGroups : opensAssets) && (
                    <OpenButton
                        name={entry.name}
                        group={group}
                        index={index}
                        onOpen={onOpen}
                        sx={row ? rowOpenSx : tileOpenSx}
                    />
                )}
                <Box component="span" sx={row ? rowCheckSx : tileCheckSx} aria-hidden>
                    <Icon name="check" />
                </Box>
            </Box>
        );
    },
);

export default AssetOption;
