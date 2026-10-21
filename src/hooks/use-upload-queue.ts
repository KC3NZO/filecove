import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { createUploadQueue } from "../store/upload-queue";

import type { FileAdapter } from "../types";

/**
 * An upload queue for as long as the component using it is mounted; unmounting cancels whatever
 * is still uploading. `onChanged` is told the folders uploads ended in (see `createUploadQueue`),
 * and may change from render to render.
 */
export const useUploadQueue = (onChanged: (adapter: FileAdapter, folderIds: string[]) => void) => {
    const onChangedRef = useRef(onChanged);

    useLayoutEffect(() => {
        onChangedRef.current = onChanged;
    });

    const [queue] = useState(() =>
        createUploadQueue((adapter, folderIds) => onChangedRef.current(adapter, folderIds)),
    );
    const items = useSyncExternalStore(queue.subscribe, queue.getItems);

    useEffect(() => () => queue.abortAll(), [queue]);

    return { queue, items };
};
