import type { FileAdapter } from "./adapter";
import type { IconSource } from "./icon";

/**
 * Which other sections a section takes entries from (`Section.importFrom`): every one (`true`),
 * none (`false`), only the sections with the ids in `allow`, or all but those in `deny`.
 */
export type SectionImports =
    | boolean
    | { allow: readonly string[]; deny?: never }
    | { deny: readonly string[]; allow?: never };

/**
 * A sidebar entry with its own root folder. Sections are independent of each other, even when
 * they share an adapter: "/server/project/a" and "/server/project/b" can be two sections.
 */
export interface Section {
    id: string;
    label: string;
    icon?: IconSource;
    /** Folder the section opens at, as an id its adapter understands. */
    rootId: string;
    /** Backend for this section; the file manager's `adapter` when omitted. */
    adapter?: FileAdapter;
    /**
     * Whether the sidebar shows the section's folders as an expandable tree beneath its row.
     * When false, the row is a plain place, as in GNOME Files, and has no expand toggle.
     * @default true
     */
    showFolders?: boolean;
    /**
     * Which other sections entries can be moved or copied into this one from, by dragging,
     * pasting, "Move to…" or "Copy to…". Only sections served by the same adapter can ever be
     * among them, since another adapter's ids mean nothing to this one's, and moving or copying
     * within the section is always allowed.
     *
     * - `true`: every other section.
     * - `false`: none.
     * - `{ allow: [...] }`: only the sections with these ids.
     * - `{ deny: [...] }`: every other section but these.
     * @default true
     */
    importFrom?: SectionImports;
    /**
     * Whether files can be uploaded into the section's folders, by the file picker or by dropping
     * them from the desktop. Uploading also needs the section's adapter to have `upload`.
     * @default true
     */
    acceptUploads?: boolean;
}

/** Sections shown together in the sidebar, divided from the next group by a rule. */
export interface SectionGroup {
    id: string;
    /** Optional heading above the group. */
    title?: string;
    sections: Section[];
}

/** A folder known by id and name, e.g. one step of the current path. */
export interface FolderRef {
    id: string;
    name: string;
}

/** A folder of a section, e.g. one expanded in the sidebar tree. A section's own row is its root folder. */
export interface SectionFolder {
    sectionId: string;
    folderId: string;
}
