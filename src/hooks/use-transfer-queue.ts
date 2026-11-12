import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { createTransferQueue } from "../store/transfer-queue";

import type { AcrossText } from "../store/transfer-across";
import type { TransferEnded } from "../store/transfer-queue";

/**
 * A copy and move queue for as long as the component using it is mounted; unmounting cancels
 * whatever is still under way. `onEnded` is told as each copy or move ends (see
 * `createTransferQueue`), and `text` words a copy between adapters; both may change from render to
 * render.
 */
export const useTransferQueue = (onEnded: TransferEnded, text: AcrossText) => {
    const onEndedRef = useRef(onEnded);
    const textRef = useRef(text);

    useLayoutEffect(() => {
        onEndedRef.current = onEnded;
        textRef.current = text;
    });

    const [queue] = useState(() =>
        createTransferQueue((item, outcome, items, made) => onEndedRef.current(item, outcome, items, made), {
            keptBothName: (name, number) => textRef.current.keptBothName(name, number),
            serverError: (status, statusText) => textRef.current.serverError(status, statusText),
        }),
    );
    const items = useSyncExternalStore(queue.subscribe, queue.getItems, queue.getItems);

    useEffect(() => () => queue.abortAll(), [queue]);

    return { queue, items };
};
