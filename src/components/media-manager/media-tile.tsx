import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useAssetLook } from "../../hooks/use-asset-look";
import { useLocale } from "../../hooks/use-locale";
import { TILE_LAYOUTS } from "../../styles/media-layout";
import { forcedColors, visuallyHiddenSx } from "../../styles/mixins";
import { withSx } from "../../styles/sx";
import { KIND_ICONS } from "../../utils/media";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import { HoldBar, HoldLine } from "./asset-hold";

import type { MediaAssetLookProps, MediaKind } from "../../types";

const rootSx = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    gap: 0.75,
    minWidth: 0,
} as const;

// The picture, or the file's icon, in a box the tile's width and the kind's shape, its own corners
// rounded within the tile's. A selected tile rings it in `primary`, so a picture filling it still
// shows the selection.
const frameSx = (ratio: string): SxProps<Theme> => ({
    position: "relative",
    aspectRatio: ratio,
    borderRadius: 2,
    overflow: "hidden",
    bgcolor: "action.hover",
    "[role='option'][aria-selected='true'] &": {
        outline: "3px solid",
        outlineColor: "primary.main",
        outlineOffset: "-3px",
    },
    // An asset that can't be chosen now is faded, as a file being uploaded is.
    "[data-held='true'] & > [data-part='picture']": { opacity: 0.55 },
    // One there's no room for is only dimmed, as taking another out makes room.
    "[data-limited='true'] & > [data-part='picture']": { opacity: 0.7 },
    [forcedColors]: { "[role='option'][aria-selected='true'] &": { outlineColor: "HighlightText" } },
});

const FRAME_SX: Record<MediaKind, SxProps<Theme>> = {
    image: frameSx(TILE_LAYOUTS.image.ratio),
    video: frameSx(TILE_LAYOUTS.video.ratio),
    document: frameSx(TILE_LAYOUTS.document.ratio),
    audio: frameSx(TILE_LAYOUTS.audio.ratio),
};

const pictureBoxSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const pictureSx: SxProps<Theme> = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    // A page shows from its top, where its title is.
    '[data-kind="document"] &': { objectPosition: "top" },
};

// A video's or a piece of audio's length, when the listing says it, or the app's own badge, at the frame's bottom start
// corner, on the panel's own surface, so it reads over any picture.
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
 * How the media manager draws an asset of a library of tiles, for an app's `renderAsset` to change a
 * little: `<MediaTile {...params} detail={params.asset.meta?.show} />`. Its picture or icon in the
 * kind's shape, with a video's or a piece of audio's length over it, and its name, with a picture's
 * or a video's dimensions, or a document's or a piece of audio's size, under it, or in their place why it can't be chosen now, with a bar on the picture
 * while it's processed. Its look only: what makes it an asset to select, its check and its Open
 * button stay the media manager's, around it, so it's only drawn inside `renderAsset`.
 */
const MediaTile = ({ asset, kind, thumbnail, hold, title, detail, badge, picture, sx }: MediaAssetLookProps) => {
    const { formatDuration, formatNumber, formatSize, text } = useLocale();
    const duration = badge === undefined && (kind === "video" || kind === "audio") ? asset.media?.duration : undefined;
    const { width, height } = asset.media ?? {};
    const measured = detail === undefined && kind !== "document" && width !== undefined && height !== undefined;

    useAssetLook();

    return (
        <Box data-kind={kind} sx={withSx(rootSx, sx)}>
            <Box sx={FRAME_SX[kind]}>
                <Box data-part="picture" sx={pictureBoxSx}>
                    {picture !== undefined ? (
                        picture
                    ) : thumbnail ? (
                        <Box component="img" src={thumbnail} alt="" draggable={false} sx={pictureSx} />
                    ) : (
                        <FileTypeIcon fileName={asset.name} size={kind === "video" ? "30%" : "42%"} />
                    )}
                </Box>
                {badge !== undefined && badge !== null && (
                    <Box component="span" sx={badgeSx}>
                        {badge}
                    </Box>
                )}
                {duration !== undefined && (
                    <Box component="span" sx={badgeSx} aria-hidden>
                        <Icon name={KIND_ICONS[kind]} />
                        <bdi>{formatDuration(duration)}</bdi>
                    </Box>
                )}
                {hold && <HoldBar hold={hold} place="frame" />}
            </Box>
            <Box sx={textSx}>
                <Typography variant="body2" noWrap sx={nameSx}>
                    {title ?? asset.name}
                </Typography>
                {hold ? (
                    <HoldLine hold={hold} />
                ) : detail !== undefined ? (
                    detail !== null && (
                        <Typography variant="caption" noWrap sx={detailSx}>
                            <bdi>{detail}</bdi>
                        </Typography>
                    )
                ) : measured ? (
                    <Typography variant="caption" noWrap sx={detailSx} aria-hidden>
                        <bdi>{`${formatNumber(width)} × ${formatNumber(height)}`}</bdi>
                    </Typography>
                ) : (
                    (kind === "document" || kind === "audio") &&
                    asset.size !== undefined && (
                        <Typography variant="caption" noWrap sx={detailSx}>
                            <bdi>{formatSize(asset.size)}</bdi>
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
};

export default MediaTile;
