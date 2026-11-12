import { useCallback, useEffect, useRef, useState } from "react";

// Left for the app's bundler to fill in, so its development build warns and its production one
// carries none of it.
declare const process: { env: { NODE_ENV?: string } };

interface ControlledOptions<T> {
    /** The app's value, when it keeps it. */
    controlled: T | undefined;
    /** What it starts at otherwise. */
    default: T | undefined;
    /** Names the component in the warnings. */
    name: string;
    /** Names the prop in the warnings; `value` when omitted. */
    state?: string;
}

/**
 * A value the app may keep itself: `controlled` while it's passed, or else one kept here, starting
 * at `default`. Whether the app keeps it is decided as the component mounts, and setting it only
 * changes the one kept here. In development it warns about switching between the two, and about
 * a default changing after mounting, either of which would be silently ignored.
 */
export const useControlled = <T>({ controlled, default: defaultValue, name, state = "value" }: ControlledOptions<T>) => {
    const { current: isControlled } = useRef(controlled !== undefined);
    const [own, setOwn] = useState(defaultValue);
    const value = isControlled ? controlled : own;

    if (process.env.NODE_ENV !== "production") {
        // The environment never changes while the page runs, so the hooks below always run, or never.
        /* oxlint-disable react/rules-of-hooks, react-hooks/rules-of-hooks */
        const { current: firstDefault } = useRef(defaultValue);

        useEffect(() => {
            if (isControlled !== (controlled !== undefined)) {
                console.error(
                    `${name}: \`${state}\` changed from being ${isControlled ? "" : "un"}controlled to being ${isControlled ? "un" : ""}controlled. ` +
                        `Decide between a controlled and an uncontrolled \`${state}\` for the lifetime of the component.`,
                );
            }
        }, [controlled, isControlled, name, state]);

        useEffect(() => {
            if (!isControlled && JSON.stringify(firstDefault) !== JSON.stringify(defaultValue)) {
                console.error(
                    `${name}: the default \`${state}\` changed after mounting, which has no effect. ` +
                        `To change \`${state}\` from outside, control it.`,
                );
            }
        }, [defaultValue, firstDefault, isControlled, name, state]);
        /* oxlint-enable react/rules-of-hooks, react-hooks/rules-of-hooks */
    }

    const set = useCallback(
        (next: T) => {
            if (!isControlled) {
                setOwn(next);
            }
        },
        [isControlled],
    );

    return [value, set] as const;
};
