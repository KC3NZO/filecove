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
     * pasting, "Move to…" or "Copy to…": sections served by the same adapter, which moves or copies
     * them itself, and those served by another, which the file manager copies into this section's
     * folders, reading them through their adapter and writing them through this one's `upload` and
     * `createFolder`, and for a move deleting them from theirs. Moving or copying within the
     * section is always allowed. A `readOnly` section, or a folder whose permissions refuse writing,
     * takes nothing either way.
     *
     * - `true`: every other section.
     * - `false`: none.
     * - `{ allow: [...] }`: only the sections with these ids.
     * - `{ deny: [...] }`: every other section but these.
     * @default true
     */
    importFrom?: SectionImports;
    /**
     * Which files can be uploaded into the section's folders, by the file picker, by dropping them
     * from the desktop or by pasting them: any (`true`), none (`false`), or those matching a string
     * in the file input's `accept` syntax, extensions, MIME types and their wildcards, such as
     * `"image/*,.pdf"`. The picker offers only those, and files of other types picked anyway,
     * dropped or pasted are left out, saying which types the section takes. Uploading also needs
     * the section's adapter to have `upload`, which still has the final say. It's about files from
     * outside the file manager: entries copied in from a section another adapter serves are
     * `importFrom`'s, though they arrive through `upload` too, which can refuse what it won't take.
     * @default true
     */
    acceptUploads?: boolean | string;
    /**
     * Whether nothing in the section can be changed through the file manager, whatever its adapter
     * allows: no folder is created, nothing is uploaded, pasted, dropped, moved or copied in, and
     * nothing is renamed, moved out or deleted. Its entries can still be copied into other sections,
     * downloaded and previewed, which is only reading. The same folders shown in another section
     * still change there, as sections are independent.
     * @default false
     */
    readOnly?: boolean;
    /**
     * Whether the section is its adapter's trash: `rootId` is where the adapter's `trash` puts
     * entries, which its listing hands back with `trashed`. The list shows where each came from and
     * when it was moved there, the trash's own bar offers to empty it, and entries dropped on it
     * are moved to the trash. Its root's entries are restored (`ActionContext.restore`, through the
     * adapter's `restore`) or deleted for good, and nothing else changes in it: nothing is created,
     * uploaded, pasted, dropped, copied or moved in or out, or renamed, and what's inside its
     * folders stays as it is. They can still be opened, previewed, downloaded and shown in the
     * properties. A search everywhere leaves it out.
     * @default false
     */
    trash?: boolean;
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
