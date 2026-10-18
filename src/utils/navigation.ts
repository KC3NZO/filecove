import type { FolderRef, Section } from "../types";

/** The folder a place points at: the end of its trail, or the section root. */
export const folderOf = (section: Section, trail: FolderRef[]): FolderRef =>
    trail.at(-1) ?? { id: section.rootId, name: section.label };
