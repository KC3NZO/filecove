import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaRow, MediaTile } from "../src";

import type { MediaAssetParams } from "../src";

// How the playground draws assets of two libraries itself, as an app would, one each way: a little
// changed, from the media manager's own look, and entirely its own.

const stockSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
    minWidth: 0,
};

const stockPictureSx: SxProps<Theme> = {
    aspectRatio: "4 / 3",
    borderRadius: 1,
    bgcolor: "action.hover",
    overflow: "hidden",
    "& > img": { display: "block", width: "100%", height: "100%", objectFit: "cover" },
};

const creditSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

/**
 * This site's audio as the media manager draws it, but for a podcast's episodes, which go by their
 * title and show, as this backend hands them over in `meta`, rather than the file's name and type.
 */
export const renderAudio = (params: MediaAssetParams) => {
    const Look = params.layout === "list" ? MediaRow : MediaTile;

    return (
        <Look
            {...params}
            title={params.asset.meta?.title as string | undefined}
            detail={params.asset.meta?.show as string | undefined}
        />
    );
};

/**
 * Stock photos drawn entirely by the playground, wider, with whom they're from. The check, the Open
 * button and, for those whose licence has run out, the fading and the reason are the media manager's.
 */
export const renderStock = ({ asset, thumbnail }: MediaAssetParams) => (
    <Box sx={stockSx}>
        <Box sx={stockPictureSx}>{thumbnail && <img src={thumbnail} alt="" draggable={false} />}</Box>
        <Typography variant="body2" noWrap>
            {asset.name}
        </Typography>
        <Typography variant="caption" noWrap sx={creditSx}>
            Northwind Stock
        </Typography>
    </Box>
);
