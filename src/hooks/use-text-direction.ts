import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

import { isRtl } from "../utils/dom";

import type { TextDirection } from "../types";

/**
 * Which way the text runs where `ref`'s element is, as a `dir` on it or above it sets it: read once
 * the element is in the page, before it's painted, and again whenever any `dir` in the page changes,
 * as it does when an app switches language.
 */
export const useTextDirection = (ref: RefObject<HTMLElement | null>) => {
    const [direction, setDirection] = useState<TextDirection>("ltr");

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const read = () => setDirection(isRtl(element) ? "rtl" : "ltr");
        const observer = new MutationObserver(read);

        read();
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dir"], subtree: true });

        return () => observer.disconnect();
    }, [ref]);

    return direction;
};
