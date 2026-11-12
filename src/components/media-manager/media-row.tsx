import { useAssetLook } from "../../hooks/use-asset-look";
import { useLocale } from "../../hooks/use-locale";
import { fmClasses } from "../../styles/classes";
import util from "../../styles/util.module.css";
import { joinIsolated } from "../../utils/bidi";
import { cx } from "../../utils/cx";
import { KIND_ICONS } from "../../utils/media";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import Text from "../ui/text";
import { HoldBar, HoldLine } from "./asset-hold";
import AssetTrail, { TrailRoom } from "./asset-trail";
import styles from "./media-row.module.css";

import type { MediaAssetLookProps } from "../../types";

// The line under the name, empty, so a row with nothing to say there is as tall as the others.
const emptyDetail = (
    <Text variant="caption" className={styles.detail} aria-hidden>
        {"\u00a0"}
    </Text>
);

/**
 * How the media manager draws an asset of a library shown as a list, for an app's `renderAsset` to
 * change a little: `<MediaRow {...params} title={params.asset.meta?.title} />`. Its picture or icon,
 * its name, its type, size and dimensions, or in their place why it can't be chosen now, with a bar
 * along its picture's foot while it's processed, and its length. Every row is as tall: the line under
 * the name is kept, empty or not, and so is a trail's while the grid shows results with them. Its look only: what makes it an asset to select, its Open
 * button and its check stay the media manager's, beside it, so it's only drawn inside `renderAsset`.
 * A group, an entry of `kind: "folder"`, is drawn as one: its picture or a folder's icon, and how many
 * it holds under its name. A search's result from further down says where it is, under those.
 */
const MediaRow = ({ asset, kind, thumbnail, hold, trail, title, detail, badge, picture, className }: MediaAssetLookProps) => {
    const { describeType, formatDuration, formatNumber, formatSize, text } = useLocale();
    const group = asset.kind === "folder";
    const duration = !group && badge === undefined ? asset.media?.duration : undefined;
    const { width, height } = asset.media ?? {};
    const facts = [describeType(asset), ...(asset.size !== undefined ? [formatSize(asset.size)] : [])];
    const measured = !group && detail === undefined && width !== undefined && height !== undefined;

    useAssetLook();

    return (
        <div className={cx(styles.root, fmClasses.mediaRow, className)}>
            <div className={styles.cover}>
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
                {hold && <HoldBar hold={hold} place="frame" />}
            </div>
            <div className={styles.text}>
                <Text variant="body2" noWrap>
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
                    <>
                        <Text variant="caption" noWrap className={styles.detail} aria-hidden>
                            {joinIsolated([...facts, `${formatNumber(width)} × ${formatNumber(height)}`])}
                        </Text>
                        <span className={util.visuallyHidden}>
                            {joinIsolated([...facts, text.mediaDimensions(formatNumber(width), formatNumber(height))])}
                        </span>
                    </>
                ) : (
                    <Text variant="caption" noWrap className={styles.detail}>
                        {joinIsolated(facts)}
                    </Text>
                )}
                {trail && trail.length > 0 ? <AssetTrail trail={trail} /> : <TrailRoom />}
            </div>
            {group && (
                <span className={util.visuallyHidden}>
                    {text.mediaGroup}
                </span>
            )}
            {badge !== undefined && badge !== null && (
                <span className={styles.duration}>
                    <bdi>{badge}</bdi>
                </span>
            )}
            {duration !== undefined && (
                <>
                    <span className={styles.duration} aria-hidden>
                        <bdi>{formatDuration(duration)}</bdi>
                    </span>
                    <span className={util.visuallyHidden}>
                        {text.mediaDuration(formatDuration(duration))}
                    </span>
                </>
            )}
        </div>
    );
};

export default MediaRow;
