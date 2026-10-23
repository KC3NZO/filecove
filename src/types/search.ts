// Internal to the package, not exported from the package entry.

/**
 * What a search covers: the open folder ("folder", Ctrl+F and the button by the path bar) or every
 * section checked in the field's sections menu ("everywhere", Ctrl+Shift+F and the magnifier at the
 * top of the sidebar), as GNOME Files splits them.
 */
export type SearchScope = "folder" | "everywhere";
