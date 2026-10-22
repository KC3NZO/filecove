import type { MouseEvent } from "react";

import { isRtl } from "./dom";

import type { MenuPosition } from "../types";

/** At the pointer, for right-clicks. */
export const pointerPosition = (event: MouseEvent): MenuPosition => ({
    top: event.clientY,
    left: event.clientX,
    rtl: isRtl(event.currentTarget),
});

/**
 * Just inside an element's top corner on its start side, the left or, right to left, the right, for
 * a menu opened with the keyboard on an area such as a folder's view.
 */
export const insideElement = (element: Element): MenuPosition => {
    const rect = element.getBoundingClientRect();
    const rtl = isRtl(element);

    return { top: rect.top + 8, left: rtl ? rect.right - 8 : rect.left + 8, rtl };
};

/** Just below an element, lined up with its start side, for menu buttons. */
export const belowElement = (element: Element): MenuPosition => {
    const rect = element.getBoundingClientRect();
    const rtl = isRtl(element);

    return { top: rect.bottom, left: rtl ? rect.right : rect.left, rtl };
};
