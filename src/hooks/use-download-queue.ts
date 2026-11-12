import { useEffect, useState, useSyncExternalStore } from "react";

import { createDownloadQueue } from "../store/download-queue";

/**
 * A download queue for as long as the component using it is mounted; unmounting cancels whatever
 * is still being prepared.
 */
export const useDownloadQueue = () => {
    const [queue] = useState(createDownloadQueue);
    const items = useSyncExternalStore(queue.subscribe, queue.getItems, queue.getItems);

    useEffect(() => () => queue.abortAll(), [queue]);

    return { queue, items };
};
