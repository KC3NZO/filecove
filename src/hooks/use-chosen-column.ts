import { useCallback, useEffect, useRef, useState } from "react";

/** Whether a column is an overlay, as the container queries lay it out, read from its style. */
export const overlays = (pane: HTMLElement) => getComputedStyle(pane).position === "absolute";

/**
 * The selected column of a media manager or a picker: docked where there's room, or an overlay while
 * opened. `present` says whether it's there at all. `frameRef` goes on what its width follows,
 * `chosenRef` on the column's box and `openerRef` on the button opening it.
 */
export const useChosenColumn = (present: boolean) => {
    const [chosenOverlay, setChosenOverlay] = useState(false);
    const [docked, setDocked] = useState(true);
    const frameRef = useRef<HTMLDivElement>(null);
    const chosenRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLButtonElement>(null);

    // Follows the column docking as the root's width changes, and closes the overlay as it docks,
    // so narrowing again doesn't bring it back unasked.
    useEffect(() => {
        const frame = frameRef.current;
        const pane = chosenRef.current;

        if (!frame || !pane) {
            return;
        }

        const observer = new ResizeObserver(() => {
            const nowDocked = !overlays(pane);

            setDocked(nowDocked);

            if (nowDocked) {
                setChosenOverlay(false);
            }
        });

        observer.observe(frame);

        return () => observer.disconnect();
    }, [present]);

    // The overlay takes the focus as it opens.
    useEffect(() => {
        if (chosenOverlay) {
            chosenRef.current?.querySelector<HTMLElement>("section")?.focus();
        }
    }, [chosenOverlay]);

    const closeChosen = useCallback(() => {
        setChosenOverlay(false);
        openerRef.current?.focus();
    }, []);

    return { chosenOverlay, setChosenOverlay, docked, frameRef, chosenRef, openerRef, closeChosen };
};
