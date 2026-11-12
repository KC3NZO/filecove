import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";

import { useControlled } from "./use-controlled";

/** What's selected, in the order set, and where a Shift-click's range starts, which is never the app's. */
export interface PicksState<P, A> {
    items: readonly P[];
    anchor: A | null;
}

interface PicksOptions<P, T, G> {
    /** Names the component in the warning about switching between controlled and not. */
    component: string;
    /** What's selected, when the app keeps it. */
    value: readonly G[] | undefined;
    /** What's selected as it mounts, while the app doesn't. */
    defaultValue: readonly G[] | undefined;
    /** Told what's selected, as it changes. */
    onChange: ((value: T[]) => void) | undefined;
    /** The picks the app's list means, with `known`, those it was last told of and those kept, for what it can't say. */
    given: (list: readonly G[], known: readonly P[]) => P[];
    /** The list the app is told of, for picks. */
    told: (items: readonly P[]) => T[];
    /** Whether two picks are one to the app: a new listing's entry for an asset isn't a change. */
    sameItem: (a: P, b: P) => boolean;
    keyOf: (item: P) => string;
}

const NO_LIST: readonly never[] = [];

const sameList = <T>(a: readonly T[], b: readonly T[], same: (a: T, b: T) => boolean) =>
    a === b || (a.length === b.length && a.every((item, index) => same(item, b[index])));

/**
 * What's selected in a media manager or a picker, which the app may keep, as a controlled prop is: `value` while it's passed, or else kept here, starting at `defaultValue`. Its picks hold more
 * than the app's list says (where each was picked, what's been listed of it since), so while the app
 * keeps it they're made from its list as it changes.
 *
 * Every change goes through the setter returned, and only one the app would see is told. While
 * the app keeps the list, such a change is only asked for, the rest being made at once. Two changes
 * in one event build on each other, the second seeing the first until the next render says what came of it.
 * What the app gives (`G`) may ask less of it than what it's told of (`T`).
 */
export const usePicks = <P, A, T, G = T>({
    component,
    value,
    defaultValue,
    onChange,
    given,
    told,
    sameItem,
    keyOf,
}: PicksOptions<P, T, G>) => {
    // Only for its warning: what's kept has more in it than the app's list.
    useControlled<readonly G[]>({ controlled: value, default: NO_LIST, name: component, state: "value" });

    const [state, setState] = useState<PicksState<P, A>>(() => ({
        items: given(value ?? defaultValue ?? NO_LIST, NO_LIST),
        anchor: null,
    }));
    const [seen, setSeen] = useState(value);
    // What the app was last asked to take, for what its list can't say of those it hands back.
    const askedRef = useRef<readonly P[]>(NO_LIST);
    // Those already told as gone, so an app not taking it isn't told again at each render.
    const goneRef = useRef<ReadonlySet<string>>(new Set());

    if (value !== seen) {
        setSeen(value);

        if (value && !(seen && sameList(value, seen, Object.is))) {
            setState((previous) => ({ ...previous, items: given(value, [...askedRef.current, ...previous.items]) }));
        }
    }

    const latest = useRef({ state, controlled: value !== undefined, onChange, told, sameItem, keyOf });

    useLayoutEffect(() => {
        latest.current = { state, controlled: value !== undefined, onChange, told, sameItem, keyOf };
    });

    const setPicks = useCallback((next: SetStateAction<PicksState<P, A>>) => {
        const { state: now, controlled, onChange: tell, told: listOf, sameItem: same } = latest.current;
        const changed = typeof next === "function" ? next(now) : next;

        if (changed === now) {
            return;
        }

        const differs = !sameList(changed.items, now.items, same);

        latest.current.state = changed;

        if (differs && controlled) {
            askedRef.current = changed.items;
            // A new object even with no new anchor, so a render follows, and what the app didn't take is forgotten.
            setState((previous) => ({ ...previous, anchor: changed.anchor }));
        } else {
            setState(changed);
        }

        if (differs) {
            tell?.(listOf(changed.items));
        }
    }, []);

    /**
     * Takes out picks found to be gone, by their keys, those no longer listed where they were picked or
     * of a library gone, so the app's list doesn't go on holding what's no longer shown.
     */
    const dropGone = useCallback(
        (goneKeys: readonly string[]) => {
            const fresh = new Set(goneKeys.filter((key) => !goneRef.current.has(key)));

            goneRef.current = new Set(goneKeys);

            if (fresh.size > 0) {
                setPicks((previous) => ({
                    ...previous,
                    items: previous.items.filter((item) => !fresh.has(latest.current.keyOf(item))),
                }));
            }
        },
        [setPicks],
    );

    return { picks: state, setPicks, dropGone };
};
