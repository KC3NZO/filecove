import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { createTransferQueue } from "../store/transfer-queue";

import type { TransferOutcome } from "../store/transfer-queue";
import type { TransferItem } from "../types";

/**
 * A copy and move queue for as long as the component using it is mounted; unmounting cancels
 * whatever is still under way. `onEnded` is told as each copy or move ends (see
 * `createTransferQueue`), and may change from render to render.
 */
export const useTransferQueue = (
    onEnded: (item: TransferItem, outcome: TransferOutcome, items: TransferItem[]) => void,
) => {
    const onEndedRef = useRef(onEnded);

    useLayoutEffect(() => {
        onEndedRef.current = onEnded;
    });

    const [queue] = useState(() =>
        createTransferQueue((item, outcome, items) => onEndedRef.current(item, outcome, items)),
    );
    const items = useSyncExternalStore(queue.subscribe, queue.getItems);

    useEffect(() => () => queue.abortAll(), [queue]);

    return { queue, items };
};
