import type { IconName, MediaKind } from "../types";

/** The icon of a library of each kind, where its section brings none, and of its empty state. */
export const KIND_ICONS: Record<MediaKind, IconName> = {
    image: "pictures",
    video: "videos",
    audio: "music",
    document: "documents",
};
