/** The nearest ancestor of an element that scrolls vertically, or null when none does. */
export const scrollParent = (element: HTMLElement) => {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);

        if (overflowY === "auto" || overflowY === "scroll") {
            return node;
        }
    }

    return null;
};

/** How many tracks a grid container lays out in each row. */
export const gridColumns = (element: Element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length || 1;

/**
 * Whether an element's text runs right to left, as a `dir` on it or above it makes it. That swaps
 * what Left and Right mean, and which way a menu opens.
 */
export const isRtl = (element: Element) => getComputedStyle(element).direction === "rtl";

/** Whether the focus has left the page, as it does when the focused element is removed. */
export const focusLost = () => !document.activeElement || document.activeElement === document.body;

/** A length in rem as device pixels, at the root's font size and the screen's pixel ratio, rounded up. */
export const devicePixels = (rem: number) =>
    Math.ceil(rem * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * window.devicePixelRatio);
