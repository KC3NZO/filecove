import { isolate } from "./bidi";

import type { FileEntry, FileManagerLocaleText, UploadLocaleText } from "../types";

type EntryKind = FileEntry["kind"];

/**
 * Why a name can't be given to an entry, or undefined when it can. `name` is expected trimmed.
 * Only rules that hold for nearly every backend are checked, then the backend's own (`check`, the
 * adapter's `checkName`), then clashes with the folder's listing as cached; the adapter has the
 * final say.
 */
export const nameProblem = (
    name: string,
    kind: EntryKind,
    siblings: FileEntry[] | undefined,
    text: FileManagerLocaleText,
    {
        selfId,
        check,
    }: {
        /** The entry being renamed, which can't clash with itself. */
        selfId?: string;
        /** The backend's own rules, giving its message for a name it won't take. */
        check?: (name: string) => string | null | undefined;
    } = {},
) => {
    if (name === "." || name === "..") {
        return text.nameReserved(isolate(name), kind);
    }

    if (name.includes("/")) {
        return text.nameHasSlash(kind);
    }

    const refused = check?.(name);

    if (refused) {
        return isolate(refused);
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

/** A name none of `taken` is, to keep both: in English "photos (2)", then "photos (3)" and so on. */
export const freeName = (name: string, taken: ReadonlySet<string>, text: Pick<UploadLocaleText, "keptBothName">) => {
    let number = 2;

    while (taken.has(text.keptBothName(name, number))) {
        number += 1;
    }

    return text.keptBothName(name, number);
};
