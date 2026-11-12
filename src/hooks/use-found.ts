import { useCallback, useEffect, useRef, useState } from "react";

import { ARRIVED_FOR } from "../styles/arrived";

/**
 * The row the browser's find in page last came to in a view, by id, highlighted for
 * `ARRIVED_FOR` (`data-found`), since the browser's own highlight is in the view's find layer,
 * where it doesn't show (see `FindLayer`). `markFound` highlights a row, starting over when it's
 * the one highlighted already.
 */
export const useFound = () => {
    const [foundId, setFoundId] = useState<string | null>(null);
    const timer = useRef(0);
    const frame = useRef(0);

    useEffect(
        () => () => {
            window.clearTimeout(timer.current);
            cancelAnimationFrame(frame.current);
        },
        [],
    );

    const markFound = useCallback((id: string) => {
        window.clearTimeout(timer.current);
        cancelAnimationFrame(frame.current);
        // Unmarked for a frame first, so the highlight of a row found again starts over.
        setFoundId(null);
        frame.current = requestAnimationFrame(() => {
            setFoundId(id);
            timer.current = window.setTimeout(() => setFoundId(null), ARRIVED_FOR);
        });
    }, []);

    return { foundId, markFound };
};
