import { acceptsFile, uploadPatterns } from "./files";

import type {
    DroppedFiles,
    FileAdapter,
    FileEntry,
    IconName,
    MediaKind,
    MediaSection,
    MediaUploadCheck,
    PropertyDefinitionGroup,
    RefusedName,
} from "../types";

/** The icon of a library of each kind, where its section brings none, and of its empty state. */
export const KIND_ICONS: Record<MediaKind, IconName> = {
    image: "pictures",
    video: "videos",
    audio: "music",
    document: "documents",
};

const NO_GROUPS: PropertyDefinitionGroup[] = [];

/**
 * Sorts what was picked, dropped or pasted into a library before anything is sent: files of types it
 * doesn't take (`acceptUploads`), folders, as a library is listed flat, and names its backend's own
 * rules refuse (`checkName`, asked with the library's root as the folder) are left out.
 */
export const checkMediaUpload = (
    section: MediaSection,
    adapter: FileAdapter,
    { files, folders }: DroppedFiles,
): MediaUploadCheck => {
    const patterns = uploadPatterns(section);
    const misnamed: RefusedName[] = [];
    const sent = files.filter((file) => {
        if (!acceptsFile(patterns, file)) {
            return false;
        }

        const reason = adapter.checkName?.(file.name, { kind: "file", parentId: section.rootId });

        if (reason) {
            misnamed.push({ name: file.name, reason });
        }

        return !reason;
    });

    return { files: sent, refused: files.filter((file) => !acceptsFile(patterns, file)), folders, misnamed };
};

/** What a library asks of these files before they're uploaded: its upload fields, for them. */
export const uploadFieldsFor = (section: MediaSection, files: readonly File[]) =>
    (typeof section.uploadFields === "function" ? section.uploadFields(files) : section.uploadFields) ?? NO_GROUPS;

/** Whether the groups ask anything at all. */
export const asksAnything = (groups: readonly PropertyDefinitionGroup[]) =>
    groups.some((group) => group.properties.length > 0);

/**
 * What upload fields are handed as their entry, which a definition's functions take, as nothing is
 * uploaded yet: the first file's name and type, the files' size together, and no id.
 */
export const uploadStandIn = (files: readonly File[]): FileEntry => ({
    id: "",
    name: files[0]?.name ?? "",
    kind: "file",
    size: files.reduce((total, file) => total + file.size, 0),
    mimeType: files[0]?.type || undefined,
});
