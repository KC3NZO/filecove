import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { mirroredBarSx } from "../../styles/direction";
import { forcedBarSx, visuallyHiddenSx } from "../../styles/mixins";

import type { AssetHold } from "../../types";

/**
 * Where a bar is drawn: along a tile's picture's foot, under a row's name, or along the foot of the
 * asset view's notice; the frame and the notice are positioned.
 */
type BarPlace = "frame" | "row" | "view";

interface HoldLineProps {
    hold: AssetHold;
    id?: string;
}

interface HoldBarProps {
    hold: AssetHold;
    place: BarPlace;
}

// Processing is said as a detail is, a failure in `error.main`.
const lineSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
    '&[data-status="failed"]': { color: "error.main" },
};

// Under what an app drew: only while the grid holds an asset that can't be chosen (`data-holds`), or
// this one can't, so every asset in it is as tall.
const slotSx: SxProps<Theme> = {
    display: "none",
    flexDirection: "column",
    '&[data-standing="true"], [data-holds="true"] &': { display: "flex" },
};

// As much room as a row's bar takes.
const barRoomSx: SxProps<Theme> = { mt: 0.5, height: 3 };

const BAR_SX: Record<BarPlace, SxProps<Theme>> = {
    frame: [{ position: "absolute", insetInline: 0, bottom: 0, height: 4 }, mirroredBarSx, forcedBarSx],
    row: [{ mt: 0.5, height: 3, borderRadius: 1.5 }, mirroredBarSx, forcedBarSx],
    view: [{ position: "absolute", insetInline: 0, bottom: 0, height: 3 }, mirroredBarSx, forcedBarSx],
};

/**
 * Why an asset can't be chosen now, in one line: what its backend is doing and how far along, that
 * it failed, with why for screen readers and as its tooltip, or why its library refuses it.
 */
export const HoldLine = ({ hold, id }: HoldLineProps) => (
    <Typography id={id} variant="caption" noWrap data-status={hold.status} title={hold.detail} sx={lineSx}>
        <bdi>{hold.text}</bdi>
        {hold.detail && (
            <Box component="span" sx={visuallyHiddenSx}>
                {` ${hold.detail}`}
            </Box>
        )}
    </Typography>
);

/**
 * How far along an asset's processing is, filling as its backend says, or moving while it doesn't
 * say; drawn only, as its line says it. Nothing while it isn't being processed.
 */
export const HoldBar = ({ hold, place }: HoldBarProps) =>
    hold.status === "processing" ? (
        <LinearProgress
            aria-hidden
            variant={hold.progress === undefined ? "indeterminate" : "determinate"}
            value={(hold.progress ?? 0) * 100}
            sx={BAR_SX[place]}
        />
    ) : null;

/**
 * Why an asset the app drew entirely itself can't be chosen now, under what it drew, with its bar, or
 * the same room empty while it can be, so every asset of the grid is laid out as tall.
 */
export const HoldSlot = ({ hold }: { hold: AssetHold | undefined }) => (
    <Box data-part="hold" data-standing={!!hold} sx={slotSx}>
        {hold ? (
            <HoldLine hold={hold} />
        ) : (
            <Typography variant="caption" aria-hidden sx={lineSx}>
                {"\u00a0"}
            </Typography>
        )}
        {hold?.status === "processing" ? <HoldBar hold={hold} place="row" /> : <Box sx={barRoomSx} />}
    </Box>
);
