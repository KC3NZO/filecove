import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { useLocale } from "../../hooks/use-locale";
import { TILE_LAYOUTS } from "../../styles/media-layout";
import { isolate } from "../../utils/bidi";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import LinearProgress from "../ui/linear-progress";
import Text from "../ui/text";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./upload-tile.module.css";

import type { FileUploadItem, MediaKind, MediaLayout } from "../../types";

interface UploadTileProps {
    item: FileUploadItem;
    /** The library's kind, whose tiles' shape it takes. */
    kind: MediaKind;
    /** How the library shows its assets: as tiles, or as rows. */
    layout: MediaLayout;
}

// The frame's shape, the kind's own (`TILE_LAYOUTS`), handed to its stylesheet as `--ratio`.
const FRAME_STYLES = Object.fromEntries(
    (Object.keys(TILE_LAYOUTS) as MediaKind[]).map((kind) => [kind, { "--ratio": TILE_LAYOUTS[kind].ratio } as CSSProperties]),
) as Record<MediaKind, CSSProperties>;

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
            className={row ? styles.rowBar : styles.frameBar}
        />
    );

    if (row) {
        return (
            <li className={cx(styles.row, fmClasses.mediaUpload)}>
                <div className={styles.cover}>
                    {url ? (
                        <img src={url} alt="" draggable={false} onError={() => setUrl(undefined)} />
                    ) : kind === "audio" ? (
                        <Icon name="music" />
                    ) : (
                        <FileTypeIcon fileName={file.name} size="60%" />
                    )}
                </div>
                <div className={styles.rowText}>
                    <Text variant="body2" noWrap className={styles.name}>
                        {file.name}
                    </Text>
                    {bar}
                </div>
                <Text component="span" className={styles.status}>
                    <bdi>{statusText}</bdi>
                </Text>
            </li>
        );
    }

    return (
        <li className={cx(styles.tile, fmClasses.mediaUpload)}>
            <div className={styles.frame} style={FRAME_STYLES[kind]}>
                {url ? (
                    <img src={url} alt="" draggable={false} onError={() => setUrl(undefined)} />
                ) : (
                    <FileTypeIcon fileName={file.name} size={kind === "video" ? "30%" : "42%"} />
                )}
                {bar}
            </div>
            <div className={styles.text}>
                <Text variant="body2" noWrap className={styles.name}>
                    {file.name}
                </Text>
                <Text variant="caption" noWrap className={styles.status}>
                    <bdi>{statusText}</bdi>
                </Text>
            </div>
        </li>
    );
};

export default UploadTile;
