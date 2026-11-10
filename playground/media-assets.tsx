import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaRow, MediaTile } from "../src";

import type { FileEntry, MediaAssetParams } from "../src";

// How the playground draws assets of two libraries itself, as an app would, one each way: a little
// changed, from the media manager's own look, and entirely its own; and its groups, with what each has
// of its own above what it holds, by the delivery of the assets it points at.

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

const pictureSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    bgcolor: "action.selected",
    color: "text.secondary",
    fontSize: "0.75rem",
    "& > img": { display: "block", width: "100%", height: "100%", objectFit: "cover" },
};

interface ResponsivePictureProps {
    /** A picture of Images, as its backend lists it, its delivery in `meta`. */
    entry: FileEntry | undefined;
    /** How wide it's drawn, for the browser to pick one of its sizes by, as `<img sizes>` takes it. */
    sizes: string;
    sx?: SxProps<Theme>;
}

/**
 * A picture drawn by its own delivery, as an app draws one it was handed: `src` and, once they're
 * made, its sizes in `srcset`, the browser taking the one it needs for `sizes`, which the mock's
 * pictures write on themselves. The media manager knows nothing of it.
 */
export const ResponsivePicture = ({ entry, sizes, sx }: ResponsivePictureProps) => {
    const src = textOf(entry?.meta?.src);
    const srcSet = textOf(entry?.meta?.srcset);

    return (
        <Box sx={[pictureSx, ...(Array.isArray(sx) ? sx : [sx])]}>
            {src ? <img src={src} srcSet={srcSet || undefined} sizes={srcSet ? sizes : undefined} alt="" /> : "No cover"}
        </Box>
    );
};

const groupHeaderSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 2,
    px: 2.5,
    pt: 2,
};

const headerCoverSx: SxProps<Theme> = { width: "8rem", aspectRatio: "1", borderRadius: 2 };

const headerTextSx: SxProps<Theme> = { flex: "1 1 12rem", minWidth: 0 };

const headerTypeSx: SxProps<Theme> = { color: "text.secondary", fontSize: "0.75rem", fontWeight: 600 };

const headerNameSx: SxProps<Theme> = { fontWeight: 700, fontSize: "1.25rem", overflowWrap: "anywhere" };

const headerDescriptionSx: SxProps<Theme> = { color: "text.secondary", fontSize: "0.875rem", mt: 0.5 };

const teaserSx: SxProps<Theme> = {
    flex: "0 1 16rem",
    m: 0,
    "& > video": { display: "block", width: "100%", aspectRatio: "16 / 9", borderRadius: 2, bgcolor: "common.black" },
};

const teaserCaptionSx: SxProps<Theme> = { color: "text.secondary", fontSize: "0.75rem", mt: 0.5 };

/**
 * A series' teaser, a video of Videos it points at, played by the video's own delivery as its backend
 * lists it now: its poster, and its stream, whose renditions and subtitles are the video's, made and
 * changed in Videos, never the series'. The playground plays MDN's clip in the stream's place, as its
 * library's player does, where an app would hand `meta.hls` to hls.js.
 */
const Teaser = ({ entry }: { entry: FileEntry }) => (
    <Box component="figure" sx={teaserSx}>
        <video
            controls
            preload="none"
            poster={textOf(entry.meta?.poster) || undefined}
            src={textOf(entry.meta?.sample) || undefined}
        />
        <Typography component="figcaption" sx={teaserCaptionSx}>
            Teaser · <bdi>{entry.name}</bdi> · {entry.meta?.hls ? "streamed as HLS" : "not streamed yet"}
        </Typography>
    </Box>
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
        <Box sx={groupHeaderSx}>
            {isEntry(cover) && <ResponsivePicture entry={cover} sizes="8rem" sx={headerCoverSx} />}
            <Box sx={headerTextSx}>
                {type && <Typography sx={headerTypeSx}>{type}</Typography>}
                <Typography sx={headerNameSx}>
                    <bdi>{group.name}</bdi>
                </Typography>
                {description && <Typography sx={headerDescriptionSx}>{description}</Typography>}
            </Box>
            {isEntry(teaser) && <Teaser entry={teaser} />}
        </Box>
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
