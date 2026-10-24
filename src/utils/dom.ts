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

// Safari before 16.4, and on iPads before then, only has the prefixed Fullscreen API.
type PrefixedDocument = Document & {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
};
type PrefixedElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/** Whether the page can fill the screen; iPhones' browsers can't, but for videos. */
export const fullscreenEnabled = () =>
    document.fullscreenEnabled || !!(document as PrefixedDocument).webkitFullscreenEnabled;

/** What fills the screen, through the Fullscreen API, or null. */
export const fullscreenElement = () =>
    document.fullscreenElement ?? (document as PrefixedDocument).webkitFullscreenElement ?? null;

/** Fills the screen with `element`, from a click or a key press; rejects when the browser won't. */
export const enterFullscreen = (element: HTMLElement) =>
    Promise.resolve(
        element.requestFullscreen ? element.requestFullscreen() : (element as PrefixedElement).webkitRequestFullscreen?.(),
    );

/** Leaves the screen to the browser again. */
export const exitFullscreen = () => {
    const prefixed = document as PrefixedDocument;

    return Promise.resolve(document.exitFullscreen ? document.exitFullscreen() : prefixed.webkitExitFullscreen?.()).catch(
        () => undefined,
    );
};

/** The events saying the page went in or out of full screen. */
export const FULLSCREEN_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;
