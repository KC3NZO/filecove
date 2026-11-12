import type { CSSProperties } from "react";

import { useAssetLook } from "../../hooks/use-asset-look";
import { useLocale } from "../../hooks/use-locale";
import { TILE_LAYOUTS } from "../../styles/media-layout";
import { fmClasses } from "../../styles/classes";
import util from "../../styles/util.module.css";
import { cx } from "../../utils/cx";
import { KIND_ICONS } from "../../utils/media";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import Text from "../ui/text";
import { HoldBar, HoldLine } from "./asset-hold";
import AssetTrail, { TrailRoom } from "./asset-trail";
import styles from "./media-tile.module.css";

import type { MediaAssetLookProps, MediaKind } from "../../types";

// The frame's shape, the kind's own (`TILE_LAYOUTS`), handed to its stylesheet as `--ratio`.
const FRAME_STYLES = Object.fromEntries(
    (Object.keys(TILE_LAYOUTS) as MediaKind[]).map((kind) => [kind, { "--ratio": TILE_LAYOUTS[kind].ratio } as CSSProperties]),
) as Record<MediaKind, CSSProperties>;

// The line under the name, empty, so a tile with nothing to say there is as tall as the others.
const emptyDetail = (
    <Text variant="caption" className={styles.detail} aria-hidden>
        {"\u00a0"}
    </Text>
);

/**
 * How the media manager draws an asset of a library of tiles, for an app's `renderAsset` to change a
 * little: `<MediaTile {...params} detail={params.asset.meta?.show} />`. Its picture or icon in the
 * kind's shape, with a video's or a piece of audio's length over it, and its name, with a picture's
 * or a video's dimensions, or a document's or a piece of audio's size, under it, or in their place why it can't be chosen now, with a bar on the picture
 * while it's processed. Its look only: what makes it an asset to select, its check and its Open
 * button stay the media manager's, around it, so it's only drawn inside `renderAsset`. A group, an
 * entry of `kind: "folder"`, is drawn as one: its picture, marked as a group, or a folder's icon, and
 * how many it holds under its name. A search's result from further down says where it is, under those.
 * Every tile is as tall: the line under the name is kept, empty or not, and so is a trail's while the
 * grid shows results with them.
 */
const MediaTile = ({ asset, kind, thumbnail, hold, trail, title, detail, badge, picture, className }: MediaAssetLookProps) => {
    const { formatDuration, formatNumber, formatSize, text } = useLocale();
    const group = asset.kind === "folder";
    const duration =
        !group && badge === undefined && (kind === "video" || kind === "audio") ? asset.media?.duration : undefined;
    const { width, height } = asset.media ?? {};
    const measured =
        !group && detail === undefined && kind !== "document" && width !== undefined && height !== undefined;
    // Over a picture, a group is told from an asset by this; its icon says so without one.
    const shownBadge = badge === undefined && group && thumbnail ? <Icon name="folder" /> : badge;

    useAssetLook();

    return (
        <div data-kind={kind} className={cx(styles.root, fmClasses.mediaTile, className)}>
            <div className={styles.frame} style={FRAME_STYLES[kind]}>
                <div data-part="picture" className={styles.pictureBox}>
                    {picture !== undefined ? (
                        picture
                    ) : thumbnail ? (
                        <img src={thumbnail} alt="" draggable={false} className={styles.picture} />
                    ) : group ? (
                        <Icon name="folder" className={styles.groupIcon} />
                    ) : (
                        <FileTypeIcon fileName={asset.name} size={kind === "video" ? "30%" : "42%"} />
                    )}
                </div>
                {shownBadge !== undefined && shownBadge !== null && (
                    <span className={styles.badge}>
                        {shownBadge}
                    </span>
                )}
                {duration !== undefined && (
                    <span className={styles.badge} aria-hidden>
                        <Icon name={KIND_ICONS[kind]} />
                        <bdi>{formatDuration(duration)}</bdi>
                    </span>
                )}
                {hold && <HoldBar hold={hold} place="frame" />}
            </div>
            <div className={styles.text}>
                <Text variant="body2" noWrap className={styles.name}>
                    {title ?? asset.name}
                </Text>
                {hold ? (
                    <HoldLine hold={hold} />
                ) : detail !== undefined ? (
                    detail !== null ? (
                        <Text variant="caption" noWrap className={styles.detail}>
                            <bdi>{detail}</bdi>
                        </Text>
                    ) : (
                        emptyDetail
                    )
                ) : group ? (
                    asset.childCount !== undefined ? (
                        <Text variant="caption" noWrap className={styles.detail}>
                            <bdi>{text.itemCount(asset.childCount)}</bdi>
                        </Text>
                    ) : (
                        emptyDetail
                    )
                ) : measured ? (
                    <Text variant="caption" noWrap className={styles.detail} aria-hidden>
                        <bdi>{`${formatNumber(width)} × ${formatNumber(height)}`}</bdi>
                    </Text>
                ) : (
                    (kind === "document" || kind === "audio") && asset.size !== undefined ? (
                        <Text variant="caption" noWrap className={styles.detail}>
                            <bdi>{formatSize(asset.size)}</bdi>
                        </Text>
                    ) : (
                        emptyDetail
                    )
                )}
                {trail && trail.length > 0 ? <AssetTrail trail={trail} /> : <TrailRoom />}
            </div>
            {group && (
                <span className={util.visuallyHidden}>
                    {text.mediaGroup}
                </span>
            )}
            {measured && (
                <span className={util.visuallyHidden}>
                    {text.mediaDimensions(formatNumber(width), formatNumber(height))}
                </span>
            )}
            {duration !== undefined && (
                <span className={util.visuallyHidden}>
                    {text.mediaDuration(formatDuration(duration))}
                </span>
            )}
        </div>
    );
};

export default MediaTile;
