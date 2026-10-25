import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { createTransferQueue } from "../store/transfer-queue";

import type { TransferEnded } from "../store/transfer-queue";

/**
 * A copy and move queue for as long as the component using it is mounted; unmounting cancels
 * whatever is still under way. `onEnded` is told as each copy or move ends (see
 * `createTransferQueue`), and may change from render to render.
 */
export const useTransferQueue = (onEnded: TransferEnded) => {
    const onEndedRef = useRef(onEnded);

    useLayoutEffect(() => {
        onEndedRef.current = onEnded;
    });

    const [queue] = useState(() =>
        createTransferQueue((item, outcome, items, made) => onEndedRef.current(item, outcome, items, made)),
    );
    const items = useSyncExternalStore(queue.subscribe, queue.getItems);

    useEffect(() => () => queue.abortAll(), [queue]);

    return { queue, items };
};
