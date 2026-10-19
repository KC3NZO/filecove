import type { FileEntry } from "../types";

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
    /** The entry being renamed, which can't clash with itself. */
    selfId?: string,
) => {
    if (name === "." || name === "..") {
        return `A ${kind} can't be called "${name}".`;
    }

    if (name.includes("/")) {
        return `${kind === "folder" ? "Folder" : "File"} names can't contain "/".`;
    }

    const clash = siblings?.find((entry) => entry.name === name && entry.id !== selfId);

    return clash && `A ${clash.kind} with that name already exists.`;
};

/** How much of a name to select for renaming: a file's name up to its extension, or a folder's whole name. */
export const stemLength = (name: string, kind: EntryKind) => {
    const dot = name.lastIndexOf(".");

    return kind === "file" && dot > 0 ? dot : name.length;
};

/** A name no sibling has yet, to start a new folder with: "New folder", then "New folder (2)" and so on. */
export const newFolderName = (siblings: FileEntry[] | undefined) => {
    const taken = new Set(siblings?.map((entry) => entry.name));
    let name = "New folder";

    for (let count = 2; taken.has(name); count += 1) {
        name = `New folder (${count})`;
    }

    return name;
};
