import type { FileEntry, FileManagerLocaleText } from "../types";

type EntryKind = FileEntry["kind"];

/**
 * Why a name can't be given to an entry, or undefined when it can. `name` is expected trimmed.
 * Only rules that hold for nearly every backend are checked, plus clashes with the folder's
 * listing as cached; the adapter has the final say.
 */
export const nameProblem = (
    name: string,
    kind: EntryKind,
    siblings: FileEntry[] | undefined,
    text: FileManagerLocaleText,
    /** The entry being renamed, which can't clash with itself. */
    selfId?: string,
) => {
    if (name === "." || name === "..") {
        return text.nameReserved(name, kind);
    }

    if (name.includes("/")) {
        return text.nameHasSlash(kind);
    }

    const clash = siblings?.find((entry) => entry.name === name && entry.id !== selfId);

    return clash && text.nameTaken(clash.kind);
};

/** How much of a name to select for renaming: a file's name up to its extension, or a folder's whole name. */
export const stemLength = (name: string, kind: EntryKind) => {
    const dot = name.lastIndexOf(".");

    return kind === "file" && dot > 0 ? dot : name.length;
};

/** A name no sibling has yet, to start a new folder with: in English "New folder", then "New folder (2)" and so on. */
export const newFolderName = (siblings: FileEntry[] | undefined, text: FileManagerLocaleText) => {
    const taken = new Set(siblings?.map((entry) => entry.name));
    let number = 1;

    while (taken.has(text.untitledFolder(number))) {
        number += 1;
    }

    return text.untitledFolder(number);
};
