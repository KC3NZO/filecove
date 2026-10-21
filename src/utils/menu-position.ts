import type { MouseEvent } from "react";

import type { MenuPosition } from "../types";

/** At the pointer, for right-clicks. */
export const pointerPosition = (event: MouseEvent): MenuPosition => ({ top: event.clientY, left: event.clientX });

/** Just inside an element's top left corner, for a menu opened with the keyboard on an area such as a folder's view. */
export const insideElement = (element: Element): MenuPosition => {
    const rect = element.getBoundingClientRect();

    return { top: rect.top + 8, left: rect.left + 8 };
};

/** Just below an element, for menu buttons. */
export const belowElement = (element: Element): MenuPosition => {
    const rect = element.getBoundingClientRect();

    return { top: rect.bottom, left: rect.left };
};
