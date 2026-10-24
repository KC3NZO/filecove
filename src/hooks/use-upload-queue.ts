import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { createUploadQueue } from "../store/upload-queue";

import type { FileAdapter } from "../types";

/**
 * An upload queue for as long as the component using it is mounted; unmounting cancels whatever
 * is still uploading. `onChanged` is told the folders uploads ended in, and `keptBothName` words a
 * folder's name to keep both, from the host's locale (see `createUploadQueue`). Both may change
 * from render to render.
 */
export const useUploadQueue = (
    onChanged: (adapter: FileAdapter, folderIds: string[]) => void,
    keptBothName: (name: string, number: number) => string,
) => {
    const onChangedRef = useRef(onChanged);
    const keptBothNameRef = useRef(keptBothName);

    useLayoutEffect(() => {
        onChangedRef.current = onChanged;
        keptBothNameRef.current = keptBothName;
    });

    const [queue] = useState(() =>
        createUploadQueue(
            (adapter, folderIds) => onChangedRef.current(adapter, folderIds),
            (name, number) => keptBothNameRef.current(name, number),
        ),
    );
    const items = useSyncExternalStore(queue.subscribe, queue.getItems);

    useEffect(() => () => queue.abortAll(), [queue]);

    return { queue, items };
};
