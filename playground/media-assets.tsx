import { MediaRow, MediaTile } from "../src";
import { cx, Text } from "./ui";
import styles from "./media-assets.module.css";

import type { FileEntry, MediaAssetParams } from "../src";

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

/** A group as the media manager draws it, saying what it is by this backend's own word for it. */
export const renderGroup = (params: MediaAssetParams) => {
    const Look = params.layout === "list" ? MediaRow : MediaTile;
    const { type } = params.asset.meta ?? {};
    const { childCount } = params.asset;

    return (
        <Look
            {...params}
            detail={typeof type === "string" ? `${type}${childCount === undefined ? "" : ` · ${childCount}`}` : undefined}
        />
    );
};

const isEntry = (value: unknown): value is FileEntry =>
    typeof value === "object" && value !== null && "id" in value && "kind" in value;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

interface ResponsivePictureProps {
    /** A picture of Images, as its backend lists it, its delivery in `meta`. */
    entry: FileEntry | undefined;
    /** How wide it's drawn, for the browser to pick one of its sizes by, as `<img sizes>` takes it. */
    sizes: string;
    className?: string;
}

/**
 * A picture drawn by its own delivery, as an app draws one it was handed: `src` and, once they're
 * made, its sizes in `srcset`, the browser taking the one it needs for `sizes`, which the mock's
 * pictures write on themselves. The media manager knows nothing of it.
 */
export const ResponsivePicture = ({ entry, sizes, className }: ResponsivePictureProps) => {
    const src = textOf(entry?.meta?.src);
    const srcSet = textOf(entry?.meta?.srcset);

    return (
        <div className={cx(styles.picture, ...(Array.isArray(className) ? className : [className]))}>
            {src ? <img src={src} srcSet={srcSet || undefined} sizes={srcSet ? sizes : undefined} alt="" /> : "No cover"}
        </div>
    );
};

/**
 * A series' teaser, a video of Videos it points at, played by the video's own delivery as its backend
 * lists it now: its poster, and its stream, whose renditions and subtitles are the video's, made and
 * changed in Videos, never the series'. The playground plays MDN's clip in the stream's place, as its
 * library's player does, where an app would hand `meta.hls` to hls.js.
 */
const Teaser = ({ entry }: { entry: FileEntry }) => (
    <figure className={styles.teaser}>
        <video
            controls
            preload="none"
            poster={textOf(entry.meta?.poster) || undefined}
            src={textOf(entry.meta?.sample) || undefined}
        />
        <Text component="figcaption" className={styles.teaserCaption}>
            Teaser · <bdi>{entry.name}</bdi> · {entry.meta?.hls ? "streamed as HLS" : "not streamed yet"}
        </Text>
    </figure>
);

/**
 * What a group has of its own, above what it holds, as this backend lists it: its cover, a picture of
 * Images drawn in the size it needs, what it is, its name and what's written about it, and a series'
 * teaser. Nothing of it is the media manager's, which only hands the group over as listed.
 */
const GroupHeader = ({ group }: { group: FileEntry }) => {
    const { cover, teaser } = group.meta ?? {};
    const type = textOf(group.meta?.type);
    const description = textOf(group.meta?.description);

    return (
        <div className={styles.groupHeader}>
            {isEntry(cover) && <ResponsivePicture entry={cover} sizes="8rem" className={styles.headerCover} />}
            <div className={styles.headerText}>
                {type && <Text className={styles.headerType}>{type}</Text>}
                <Text className={styles.headerName}>
                    <bdi>{group.name}</bdi>
                </Text>
                {description && <Text className={styles.headerDescription}>{description}</Text>}
            </div>
            {isEntry(teaser) && <Teaser entry={teaser} />}
        </div>
    );
};

/** A group's header, for those with something of their own; one that's only a name has none. */
export const renderGroupHeader = (group: FileEntry) => {
    const { type, description, cover, teaser } = group.meta ?? {};

    return type || description || isEntry(cover) || isEntry(teaser) ? <GroupHeader group={group} /> : null;
};

/**
 * Stock photos drawn entirely by the playground, wider, with whom they're from. The check, the Open
 * button and, for those whose licence has run out, the fading and the reason are the media manager's.
 */
export const renderStock = ({ asset, thumbnail }: MediaAssetParams) => (
    <div className={styles.stock}>
        <div className={styles.stockPicture}>{thumbnail && <img src={thumbnail} alt="" draggable={false} />}</div>
        <Text variant="body2" noWrap>
            {asset.name}
        </Text>
        <Text variant="caption" noWrap className={styles.credit}>
            Northwind Stock
        </Text>
    </div>
);
