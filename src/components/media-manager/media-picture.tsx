import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef, Ref } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { withSx } from "../../styles/sx";
import { devicePixels } from "../../utils/dom";
import { FileTypeIcon, FolderTypeIcon } from "../icons/file-icon";

import type { FileAdapter, FileEntry, ViewMode } from "../../types";

export interface MediaPictureProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
    /** The asset or group to show, as the adapter listed it. */
    entry: FileEntry;
    /** Its adapter, whose `thumbnail` is asked for the picture. */
    adapter: FileAdapter;
    /** The view it's asked for (`ThumbnailOptions.view`). "list" when omitted. */
    view?: ViewMode;
    /** The side of the square it's asked to fit, in rem, for a backend making thumbnails to order. 6 when omitted. */
    size?: number;
    /** The picture's text for screen readers. None when omitted, for one shown beside its name. */
    alt?: string;
    /** The root element. */
    ref?: Ref<HTMLDivElement>;
    /** Styles the root element, over its own: its size and shape, `{ width: 72, aspectRatio: "16 / 9" }`. */
    sx?: SxProps<Theme>;
}

interface Loaded {
    /** What it's the picture of: the entry's id and when it changed. */
    key: string;
    url: string | undefined;
}

const rootSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "6rem",
    aspectRatio: "1",
    borderRadius: 1,
    overflow: "hidden",
    bgcolor: "action.hover",
    "& > img": { display: "block", width: "100%", height: "100%", objectFit: "cover" },
} satisfies SxProps<Theme>;

/**
 * An asset's or a group's small picture, asked of the adapter's `thumbnail`, for showing one outside a
 * library, such as in a field pointing at it (`MediaPicker`): filling a box the app sizes and shapes
 * with `sx`, cut to fit, or its type's icon when it has none or it fails. It needs no provider around
 * it, and keeps nothing once it's gone.
 */
const MediaPicture = ({ entry, adapter, view = "list", size = 6, alt = "", ref, sx, ...rest }: MediaPictureProps) => {
    const key = `${entry.id}/${entry.modifiedAt?.getTime() ?? ""}`;
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const url = loaded?.key === key ? loaded.url : undefined;

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl: string | undefined;

        adapter
            .thumbnail?.(entry, { signal: controller.signal, view, size: devicePixels(size) })
            .then(
                (content) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    if (content?.blob) {
                        objectUrl = URL.createObjectURL(content.blob);
                    }

                    setLoaded({ key, url: objectUrl ?? content?.url });
                },
                () => {},
            );

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
        // By its key, as an entry is a new object each time it's listed.
    }, [adapter, key, view, size]);

    return (
        <Box {...rest} ref={ref} sx={withSx(rootSx, sx)}>
            {url ? (
                <img src={url} alt={alt} draggable={false} onError={() => setLoaded({ key, url: undefined })} />
            ) : entry.kind === "folder" ? (
                <FolderTypeIcon folderName={entry.name} size="60%" />
            ) : (
                <FileTypeIcon fileName={entry.name} size="60%" />
            )}
        </Box>
    );
};

export default MediaPicture;
