import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useAssetLook } from "../../hooks/use-asset-look";
import { useLocale } from "../../hooks/use-locale";
import { ROW_PICTURE } from "../../styles/media-layout";
import { visuallyHiddenSx } from "../../styles/mixins";
import { withSx } from "../../styles/sx";
import { joinIsolated } from "../../utils/bidi";
import { KIND_ICONS } from "../../utils/media";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import { HoldBar, HoldLine } from "./asset-hold";
import AssetTrail from "./asset-trail";

import type { MediaAssetLookProps } from "../../types";

const rootSx = {
    display: "flex",
    alignItems: "center",
    flex: 1,
    gap: 1.5,
    minWidth: 0,
} as const;

// Its picture or cover, when the adapter has a thumbnail for it, or its icon, in a rounded square.
const coverSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: `${ROW_PICTURE}rem`,
    height: `${ROW_PICTURE}rem`,
    borderRadius: 1.5,
    overflow: "hidden",
    bgcolor: "action.hover",
    color: "text.secondary",
    "& > img": { width: "100%", height: "100%", objectFit: "cover" },
    // An asset that can't be chosen now is faded, as a file being uploaded is.
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
 * How the media manager draws an asset of a library shown as a list, for an app's `renderAsset` to
 * change a little: `<MediaRow {...params} title={params.asset.meta?.title} />`. Its picture or icon,
 * its name, its type, size and dimensions, or in their place why it can't be chosen now, with a bar
 * while it's processed, and its length. Its look only: what makes it an asset to select, its Open
 * button and its check stay the media manager's, beside it, so it's only drawn inside `renderAsset`.
 * A group, an entry of `kind: "folder"`, is drawn as one: its picture or a folder's icon, and how many
 * it holds under its name. A search's result from further down says where it is, under those.
 */
const MediaRow = ({ asset, kind, thumbnail, hold, trail, title, detail, badge, picture, sx }: MediaAssetLookProps) => {
    const { describeType, formatDuration, formatNumber, formatSize, text } = useLocale();
    const group = asset.kind === "folder";
    const duration = !group && badge === undefined ? asset.media?.duration : undefined;
    const { width, height } = asset.media ?? {};
    const facts = [describeType(asset), ...(asset.size !== undefined ? [formatSize(asset.size)] : [])];
    const measured = !group && detail === undefined && width !== undefined && height !== undefined;

    useAssetLook();

    return (
        <Box sx={withSx(rootSx, sx)}>
            <Box sx={coverSx}>
                {picture !== undefined ? (
                    picture
                ) : thumbnail ? (
                    <img src={thumbnail} alt="" draggable={false} />
                ) : group ? (
                    <Icon name="folder" />
                ) : kind === "audio" ? (
                    <Icon name={KIND_ICONS.audio} />
                ) : (
                    <FileTypeIcon fileName={asset.name} size="60%" />
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
                ) : detail !== undefined ? (
                    detail !== null && (
                        <Typography variant="caption" noWrap sx={detailSx}>
                            <bdi>{detail}</bdi>
                        </Typography>
                    )
                ) : group ? (
                    asset.childCount !== undefined && (
                        <Typography variant="caption" noWrap sx={detailSx}>
                            <bdi>{text.itemCount(asset.childCount)}</bdi>
                        </Typography>
                    )
                ) : measured ? (
                    <>
                        <Typography variant="caption" noWrap sx={detailSx} aria-hidden>
                            {joinIsolated([...facts, `${formatNumber(width)} × ${formatNumber(height)}`])}
                        </Typography>
                        <Box component="span" sx={visuallyHiddenSx}>
                            {joinIsolated([...facts, text.mediaDimensions(formatNumber(width), formatNumber(height))])}
                        </Box>
                    </>
                ) : (
                    <Typography variant="caption" noWrap sx={detailSx}>
                        {joinIsolated(facts)}
                    </Typography>
                )}
                {trail && trail.length > 0 && <AssetTrail trail={trail} />}
            </Box>
            {group && (
                <Box component="span" sx={visuallyHiddenSx}>
                    {text.mediaGroup}
                </Box>
            )}
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
