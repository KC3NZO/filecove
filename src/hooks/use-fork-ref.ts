import { useMemo } from "react";
import type { Ref, RefCallback } from "react";

const assign = <T>(ref: Ref<T> | undefined, value: T | null) => {
    if (typeof ref === "function") {
        ref(value);
    } else if (ref) {
        ref.current = value;
    }
};

/**
 * One ref for an element that two parts want: the component's own and the one the app passed. The
 * same function while both stay the same, so React doesn't detach and attach it at each render.
 */
export const useForkRef = <T>(first: Ref<T> | undefined, second: Ref<T> | undefined): RefCallback<T> | null =>
    useMemo(() => {
        if (!first && !second) {
            return null;
        }

        return (value) => {
            assign(first, value);
            assign(second, value);
        };
    }, [first, second]);
