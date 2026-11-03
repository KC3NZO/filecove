import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useAssetLook } from "../../hooks/use-asset-look";
import { useLocale } from "../../hooks/use-locale";
import { AUDIO_ROW } from "../../styles/media-layout";
import { visuallyHiddenSx } from "../../styles/mixins";
import { withSx } from "../../styles/sx";
import { joinIsolated } from "../../utils/bidi";
import { KIND_ICONS } from "../../utils/media";
import Icon from "../icons/icon";
import { HoldBar, HoldLine } from "./asset-hold";

import type { MediaAssetLookProps } from "../../types";

const rootSx = {
    display: "flex",
    alignItems: "center",
    flex: 1,
    gap: 1.5,
    minWidth: 0,
} as const;

// Its cover, when the adapter has a thumbnail for it, or its kind's icon, in a rounded square.
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
    // A piece of audio that can't be chosen now is faded, as a file being uploaded is.
    "[data-held='true'] & > *": { opacity: 0.55 },
    // One there's no room for is only dimmed, as taking another out makes room.
    "[data-limited='true'] & > *": { opacity: 0.7 },
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

/**
 * How the media manager draws a piece of audio, for an app's `renderAsset` to change a little:
 * `<MediaRow {...params} title={params.asset.meta?.title} />`. Its cover or icon, its name, its type
 * and size, or in their place why it can't be chosen now, with a bar while it's processed, and its
 * length. Its look only: what makes it an asset to select, its Open button and its check stay the
 * media manager's, beside it, so it's only drawn inside `renderAsset`.
 */
const MediaRow = ({ asset, kind, thumbnail, hold, title, detail, badge, picture, sx }: MediaAssetLookProps) => {
    const { describeType, formatDuration, formatSize, text } = useLocale();
    const duration = badge === undefined ? asset.media?.duration : undefined;

    useAssetLook();

    return (
        <Box sx={withSx(rootSx, sx)}>
            <Box sx={coverSx}>
                {picture !== undefined ? (
                    picture
                ) : thumbnail ? (
                    <img src={thumbnail} alt="" draggable={false} />
                ) : (
                    <Icon name={KIND_ICONS[kind]} />
                )}
            </Box>
            <Box sx={textSx}>
                <Typography variant="body2" noWrap>
                    {title ?? asset.name}
                </Typography>
                {hold ? (
                    <>
                        <HoldLine hold={hold} />
                        <HoldBar hold={hold} place="row" />
                    </>
                ) : (
                    detail !== null && (
                        <Typography variant="caption" noWrap sx={detailSx}>
                            {detail !== undefined ? (
                                <bdi>{detail}</bdi>
                            ) : (
                                joinIsolated([
                                    describeType(asset),
                                    ...(asset.size !== undefined ? [formatSize(asset.size)] : []),
                                ])
                            )}
                        </Typography>
                    )
                )}
            </Box>
            {badge !== undefined && badge !== null && (
                <Box component="span" sx={durationSx}>
                    <bdi>{badge}</bdi>
                </Box>
            )}
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
        </Box>
    );
};

export default MediaRow;
