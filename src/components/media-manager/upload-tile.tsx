import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { mirroredBarSx } from "../../styles/direction";
import { ROW_PICTURE, TILE_LAYOUTS } from "../../styles/media-layout";
import { forcedBarSx } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";

import type { FileUploadItem, MediaKind, MediaLayout } from "../../types";

interface UploadTileProps {
    item: FileUploadItem;
    /** The library's kind, whose tiles' shape it takes. */
    kind: MediaKind;
    /** How the library shows its assets: as tiles, or as rows. */
    layout: MediaLayout;
}

const tileSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.75,
    minWidth: 0,
    p: 0.75,
};

const rowSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minWidth: 0,
    px: 1,
    py: 0.75,
};

// The picture being sent, or the file's icon, faded, in the kind's shape, the bar along its foot.
const frameSx = (ratio: string): SxProps<Theme> => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: ratio,
    borderRadius: 2,
    overflow: "hidden",
    bgcolor: "action.hover",
    "& > img": {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: 0.55,
    },
    "& > svg": { opacity: 0.55 },
});

const FRAME_SX: Record<MediaKind, SxProps<Theme>> = {
    image: frameSx(TILE_LAYOUTS.image.ratio),
    video: frameSx(TILE_LAYOUTS.video.ratio),
    document: frameSx(TILE_LAYOUTS.document.ratio),
    audio: frameSx(TILE_LAYOUTS.audio.ratio),
};

const coverSx: SxProps<Theme> = {
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
    "& > img": { width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 },
    "& > svg": { opacity: 0.55 },
};

const frameBarSx: SxProps<Theme> = [
    { position: "absolute", insetInline: 0, bottom: 0, height: 4 },
    mirroredBarSx,
    forcedBarSx,
];

const rowBarSx: SxProps<Theme> = [{ mt: 0.5, height: 3, borderRadius: 1.5 }, mirroredBarSx, forcedBarSx];

const textSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    px: 0.25,
    textAlign: "center",
};

const rowTextSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
};

const nameSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.8125rem",
};

const statusSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

/**
 * A file being uploaded into the open library, shown before its assets as they are, as a tile of the
 * library's shape or a row: the picture itself when it's one, else its icon, faded, with how far
 * it's got. It's no asset yet, so it can't be selected or opened; the upload panel cancels it.
 */
const UploadTile = ({ item, kind, layout }: UploadTileProps) => {
    const { text, formatPercent } = useLocale();
    const { file, status, progress } = item;
    const row = layout === "list";
    const picture = kind === "image" && file.type.startsWith("image/");
    const [url, setUrl] = useState<string>();

    // The picture from the file's own bytes, while it's sent, revoked as the tile goes.
    useEffect(() => {
        if (!picture) {
            return undefined;
        }

        const made = URL.createObjectURL(file);

        setUrl(made);

        return () => URL.revokeObjectURL(made);
    }, [file, picture]);

    const statusText =
        status === "queued"
            ? text.uploadQueued
            : status === "done"
              ? text.uploadDone
              : progress !== undefined
                ? formatPercent(progress)
                : text.uploadUploading;

    const bar = status !== "queued" && (
        <LinearProgress
            variant={status === "done" || progress !== undefined ? "determinate" : "indeterminate"}
            value={status === "done" ? 100 : (progress ?? 0) * 100}
            aria-label={text.mediaUploadingFile(isolate(file.name))}
            sx={row ? rowBarSx : frameBarSx}
        />
    );

    if (row) {
        return (
            <Box component="li" sx={rowSx}>
                <Box sx={coverSx}>
                    {url ? (
                        <img src={url} alt="" draggable={false} onError={() => setUrl(undefined)} />
                    ) : kind === "audio" ? (
                        <Icon name="music" />
                    ) : (
                        <FileTypeIcon fileName={file.name} size="60%" />
                    )}
                </Box>
                <Box sx={rowTextSx}>
                    <Typography variant="body2" noWrap sx={nameSx}>
                        {file.name}
                    </Typography>
                    {bar}
                </Box>
                <Typography component="span" sx={statusSx}>
                    <bdi>{statusText}</bdi>
                </Typography>
            </Box>
        );
    }

    return (
        <Box component="li" sx={tileSx}>
            <Box sx={FRAME_SX[kind]}>
                {url ? (
                    <img src={url} alt="" draggable={false} onError={() => setUrl(undefined)} />
                ) : (
                    <FileTypeIcon fileName={file.name} size={kind === "video" ? "30%" : "42%"} />
                )}
                {bar}
            </Box>
            <Box sx={textSx}>
                <Typography variant="body2" noWrap sx={nameSx}>
                    {file.name}
                </Typography>
                <Typography variant="caption" noWrap sx={statusSx}>
                    <bdi>{statusText}</bdi>
                </Typography>
            </Box>
        </Box>
    );
};

export default UploadTile;
