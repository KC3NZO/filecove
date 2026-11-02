import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { AssetState, AssetStates, FileAdapter, FileEntry, FollowedAssets } from "../types";

// How often an adapter's `processing` is asked, in ms: every 2 s while what it says changes, a half
// again longer each time nothing does, up to every 10 s.
const FIRST_POLL = 2_000;
const LAST_POLL = 10_000;
const SLOWER = 1.5;

const NO_STATES: AssetStates = new Map();
const NO_IDS: ReadonlyMap<string, AssetState> = new Map();

// A number for each adapter, for telling apart the assets followed as a string.
const adapterNumbers = new WeakMap<FileAdapter, number>();
let adapterCount = 0;

const numberOf = (adapter: FileAdapter) => {
    let number = adapterNumbers.get(adapter);

    if (number === undefined) {
        adapterCount += 1;
        number = adapterCount;
        adapterNumbers.set(adapter, number);
    }

    return number;
};

const sameState = (a: AssetState | undefined, b: AssetState) => {
    if (!a || a.status !== b.status) {
        return false;
    }

    if (a.status === "ready" || b.status === "ready") {
        return a.status === "ready" && b.status === "ready" && a.entry === b.entry;
    }

    return a.progress === b.progress && a.label === b.label && a.message === b.message && a.usable === b.usable;
};

type Merge = (adapter: FileAdapter, states: Iterable<[string, AssetState]>) => boolean;

/**
 * Follows one adapter's assets: as it pushes how they stand (`watchProcessing`), or asking it
 * (`processing`), every 2 s while what it says changes and less often while it doesn't, not while
 * the page is hidden, and at once as it shows again. Returns the function that stops.
 */
const follow = (adapter: FileAdapter, entries: FileEntry[], merge: Merge) => {
    if (adapter.watchProcessing) {
        return adapter.watchProcessing(entries, (id, state) => merge(adapter, [[id, state]]));
    }

    if (!adapter.processing) {
        return () => {};
    }

    const controller = new AbortController();
    let delay = FIRST_POLL;
    let timer: number | undefined;
    let asking = false;

    const poll = () => {
        timer = undefined;

        // Asked again as the page shows.
        if (document.hidden || !adapter.processing) {
            return;
        }

        asking = true;
        adapter
            .processing(entries, { signal: controller.signal })
            .then(
                (answered) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    const changed = merge(adapter, Object.entries(answered));

                    delay = changed ? FIRST_POLL : Math.min(delay * SLOWER, LAST_POLL);
                },
                () => {
                    // Failing, it's asked less often too, until it answers.
                    delay = Math.min(delay * SLOWER, LAST_POLL);
                },
            )
            .finally(() => {
                asking = false;

                if (!controller.signal.aborted) {
                    timer = window.setTimeout(poll, delay);
                }
            });
    };

    const shown = () => {
        if (!document.hidden && timer === undefined && !asking && !controller.signal.aborted) {
            poll();
        }
    };

    document.addEventListener("visibilitychange", shown);
    timer = window.setTimeout(poll, delay);

    return () => {
        controller.abort();
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", shown);
    };
};

/**
 * How assets being processed stand, as their backends last said, for those listed as being
 * processed (`candidates`, through the adapter serving each): followed until each is ready or
 * failed, and no longer while it isn't a candidate. `onReady` is told of an adapter once one of its
 * assets is ready, so what lists it is listed again. `forget` drops what's known of assets, once
 * their listing has caught up with it, so one processed again later is followed afresh.
 */
export const useAssetStates = (
    candidates: readonly FollowedAssets[],
    onReady: (adapter: FileAdapter) => void,
) => {
    const [states, setStates] = useState(NO_STATES);
    const statesRef = useRef(states);
    const onReadyRef = useRef(onReady);

    useLayoutEffect(() => {
        onReadyRef.current = onReady;
    });

    const update = useCallback((next: AssetStates) => {
        statesRef.current = next;
        setStates(next);
    }, []);

    // Takes what a backend said, saying whether any of it is new.
    const merge = useCallback<Merge>(
        (adapter, answered) => {
            const current = statesRef.current.get(adapter) ?? NO_IDS;
            let next: Map<string, AssetState> | null = null;
            let ready = false;

            for (const [id, state] of answered) {
                if (!sameState(current.get(id), state)) {
                    next ??= new Map(current);
                    next.set(id, state);
                    ready ||= state.status === "ready";
                }
            }

            if (!next) {
                return false;
            }

            update(new Map(statesRef.current).set(adapter, next));

            if (ready) {
                onReadyRef.current(adapter);
            }

            return true;
        },
        [update],
    );

    const forget = useCallback(
        (adapter: FileAdapter, ids: readonly string[]) => {
            const current = statesRef.current.get(adapter);

            if (!current || !ids.some((id) => current.has(id))) {
                return;
            }

            const next = new Map(current);

            ids.forEach((id) => next.delete(id));
            update(new Map(statesRef.current).set(adapter, next));
        },
        [update],
    );

    // Those still to follow: listed as being processed, with nothing since saying they're done.
    const followed = useMemo(
        () =>
            candidates.flatMap(({ adapter, entries }) => {
                const own = states.get(adapter);
                const left = entries.filter((entry) => {
                    const state = own?.get(entry.id);

                    return !state || state.status === "processing";
                });

                return left.length > 0 ? [{ adapter, entries: left }] : [];
            }),
        [candidates, states],
    );

    // What's followed, as a string, so following starts again only as that changes, not as each
    // asset's progress does.
    const followedKey = followed
        .map(({ adapter, entries }) => `${numberOf(adapter)}:${entries.map(({ id }) => id).sort().join("\u0000")}`)
        .join("\n");
    const followedRef = useRef(followed);

    useLayoutEffect(() => {
        followedRef.current = followed;
    });

    useEffect(() => {
        if (followedKey === "") {
            return undefined;
        }

        const stops = followedRef.current.map(({ adapter, entries }) => follow(adapter, [...entries], merge));

        return () => stops.forEach((stop) => stop());
    }, [followedKey, merge]);

    return { states, forget };
};
