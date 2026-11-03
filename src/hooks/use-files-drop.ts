import { useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";

import { carriesFiles, filesIn, mayAccept } from "../utils/files";

import type { DroppedFiles } from "../types";

/**
 * Files dragged over a media library, dropped on it or pasted in it: the handlers for its panel, and
 * whether any are over it now. `takes` says whether it can have them at the moment, `patterns` of
 * which types as far as a drag tells.
 */
export const useFilesDrop = (
    takes: boolean,
    patterns: readonly string[] | null,
    onFiles: (files: DroppedFiles) => void,
) => {
    const [dropping, setDropping] = useState(false);

    const offerDrop = (event: DragEvent<HTMLElement>) => {
        if (carriesFiles(event) && takes && mayAccept(patterns, event.dataTransfer.items)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDropping(true);
        }
    };

    const leaveDrop = (event: DragEvent<HTMLElement>) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            setDropping(false);
        }
    };

    const takeDrop = (event: DragEvent<HTMLElement>) => {
        setDropping(false);

        if (carriesFiles(event) && takes) {
            event.preventDefault();
            onFiles(filesIn(event.dataTransfer));
        }
    };

    // With the browser's paste key, as the file manager takes them.
    const pasteFiles = (event: ClipboardEvent<HTMLElement>) => {
        if (!takes) {
            return;
        }

        const pasted = filesIn(event.clipboardData);

        if (pasted.files.length + pasted.folders.length > 0) {
            event.preventDefault();
            onFiles(pasted);
        }
    };

    return { dropping: dropping && takes, offerDrop, leaveDrop, takeDrop, pasteFiles };
};
