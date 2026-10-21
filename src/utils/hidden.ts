import type { FileEntry } from "../types";

/** Whether the entry is hidden: as the adapter says with `hidden`, or else when its name starts with a dot. */
export const isHidden = (entry: FileEntry) => entry.hidden ?? entry.name.startsWith(".");
