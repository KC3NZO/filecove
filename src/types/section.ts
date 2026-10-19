import type { FileAdapter } from "./adapter";
import type { IconSource } from "./icon";

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
