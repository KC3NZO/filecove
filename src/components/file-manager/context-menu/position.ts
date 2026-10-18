import type { MouseEvent } from "react";

import type { MenuPosition } from "../types";

/** At the pointer, for right-clicks. */
export const pointerPosition = (event: MouseEvent): MenuPosition => ({ top: event.clientY, left: event.clientX });

/** Just below an element, for menu buttons. */
export const belowElement = (element: Element): MenuPosition => {
    const rect = element.getBoundingClientRect();

    return { top: rect.bottom, left: rect.left };
};
