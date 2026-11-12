import { useCallback, useLayoutEffect, useRef } from "react";

import { useControlled } from "./use-controlled";

interface SettingOptions<T> {
    /** Names the setting in the warnings about switching between controlled and not. */
    name: string;
    /** Names the component in those warnings; `FileManager` when omitted. */
    component?: string;
    /** The consumer's value, when they control it. */
    value: T | undefined;
    defaultValue: T;
    onChange?: (value: T) => void;
    /** Whether two values are the same setting; `Object.is` when omitted. */
    equal?: (a: T, b: T) => boolean;
}

/**
 * A setting of the file manager the consumer may control, as a controlled prop is: `value`
 * while they pass it, or else one kept here, starting at `defaultValue`. Setting it tells them
 * through `onChange` either way, and changes it here only when they don't pass `value`. Setting
 * it to what it is does nothing. It's set to a value, or with a function of the value as of the
 * latest render.
 */
export const useSetting = <T>({
    name,
    component = "FileManager",
    value,
    defaultValue,
    onChange,
    equal = Object.is,
}: SettingOptions<T>) => {
    const [current, setOwn] = useControlled({
        controlled: value,
        default: defaultValue,
        name: component,
        state: name,
    });
    const latest = useRef({ current, onChange, equal });

    useLayoutEffect(() => {
        latest.current = { current, onChange, equal };
    });

    const set = useCallback(
        (next: T | ((value: T) => T)) => {
            const { current: value, equal: same, onChange: report } = latest.current;
            // No setting's value is a function, so a function is an update.
            const changed = typeof next === "function" ? (next as (value: T) => T)(value as T) : next;

            if (same(changed, value as T)) {
                return;
            }

            setOwn(changed);
            report?.(changed);
        },
        [setOwn],
    );

    return [current as T, set] as const;
};
