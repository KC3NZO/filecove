import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { equalPlace, samePlace } from "../utils/navigation";

import type { FileManagerLocation, LocationChangeReason } from "../types";

interface History {
    places: FileManagerLocation[];
    index: number;
}

/** A change asked of the consumer, who controls the location, which is made once they pass its place. */
interface Asked {
    history: History;
    reason: LocationChangeReason;
}

interface HistoryState {
    history: History;
    /** Why the current place last changed; null until it has. */
    reason: LocationChangeReason | null;
    asked: Asked | null;
    /** The location the consumer passed last, while they control it. */
    passed: FileManagerLocation | undefined;
}

interface LocationHistoryOptions {
    /** The consumer's location, when they control it, which they then change through `onChange`. */
    location: FileManagerLocation | undefined;
    /** Where the history starts when they don't. */
    initial: () => FileManagerLocation;
    /** Told every change of the current place, with why it changed. */
    onChange?: (location: FileManagerLocation, reason: LocationChangeReason) => void;
}

/**
 * Rewrites a place of the history, `current` saying whether it's the current one, or drops it by
 * returning null. The current place can't be dropped, so null keeps it: return where it goes instead.
 */
export type ReviseLocation = (place: FileManagerLocation, current: boolean) => FileManagerLocation | null;

const currentOf = (history: History) => history.places[history.index];

const withCurrent = (history: History, place: FileManagerLocation): History => ({
    places: history.places.map((visited, index) => (index === history.index ? place : visited)),
    index: history.index,
});

// Goes on to `place`, dropping whatever forward would have gone to, unless the history is there already.
const pushed = (history: History, place: FileManagerLocation): History => {
    const current = currentOf(history);

    if (equalPlace(current, place)) {
        return history;
    }

    if (samePlace(current, place)) {
        return withCurrent(history, place);
    }

    return { places: [...history.places.slice(0, history.index + 1), place], index: history.index + 1 };
};

const stepped = (history: History, by: -1 | 1): History => {
    const index = history.index + by;

    return index >= 0 && index < history.places.length ? { ...history, index } : history;
};

/**
 * The history with every place passed through `update`. Places that end up next to the same place
 * become one, so back and forward never lead to where the file manager already is.
 */
const revised = (history: History, update: ReviseLocation): History => {
    const places: FileManagerLocation[] = [];
    let index = 0;

    history.places.forEach((visited, position) => {
        const current = position === history.index;
        const place = update(visited, current) ?? (current ? visited : null);

        if (!place) {
            return;
        }

        if (places.length > 0 && samePlace(places[places.length - 1], place)) {
            if (current) {
                places[places.length - 1] = place;
                index = places.length - 1;
            }

            return;
        }

        if (current) {
            index = places.length;
        }

        places.push(place);
    });

    const unchanged =
        index === history.index &&
        places.length === history.places.length &&
        places.every((place, position) => place === history.places[position]);

    return unchanged ? history : { places, index };
};

/**
 * Takes in a location the consumer passed: the change asked of them, once it's that change's
 * place; back or forward, when it's where those lead, so the history keeps in step with a
 * browser's whose buttons set it; or else a place of their own, gone to as a new one.
 */
const passedOn = (state: HistoryState, location: FileManagerLocation): HistoryState => {
    const { history, asked } = state;
    const current = currentOf(history);

    if (asked && samePlace(currentOf(asked.history), location)) {
        return { history: withCurrent(asked.history, location), reason: asked.reason, asked: null, passed: location };
    }

    if (samePlace(current, location)) {
        return equalPlace(current, location)
            ? { ...state, asked: null, passed: location }
            : { history: withCurrent(history, location), reason: "replace", asked: null, passed: location };
    }

    const steps = [
        [-1, "back"],
        [1, "forward"],
    ] as const;

    for (const [by, reason] of steps) {
        const near = history.places[history.index + by];

        if (near && samePlace(near, location)) {
            return { history: withCurrent(stepped(history, by), location), reason, asked: null, passed: location };
        }
    }

    return { history: pushed(history, location), reason: "navigate", asked: null, passed: location };
};

/**
 * The current place, with browser-style back and forward history, which the consumer may control.
 *
 * Uncontrolled, every change is made here and then told to `onChange`. Controlled, the current place
 * is the consumer's `location`: a change is only asked of them through `onChange`, and made once
 * they pass its place, so one they don't take never happens. The back and forward history stays
 * here either way. A location they pass of their own is taken in by `passedOn`.
 */
export const useLocationHistory = ({ location, initial, onChange }: LocationHistoryOptions) => {
    // Decided once, as React's controlled inputs are.
    const { current: controlled } = useRef(location !== undefined);
    const [state, setState] = useState<HistoryState>(() => ({
        history: { places: [location ?? initial()], index: 0 },
        reason: null,
        asked: null,
        passed: location,
    }));
    let shown = state;

    // A location passed with other folders, or names, than the one passed before.
    if (controlled && location && !(state.passed && equalPlace(location, state.passed))) {
        shown = passedOn(state, location);
        setState(shown);
    }

    // The latest state, which changes made one after another before the next render build on.
    const latest = useRef(state);
    const onChangeRef = useRef(onChange);

    useLayoutEffect(() => {
        latest.current = state;
        onChangeRef.current = onChange;
    });

    // Makes a change, or asks for it while the consumer controls the location, building on any
    // change already asked for. One that leaves the current place where it was, such as dropping
    // places from the history, is made at once.
    const change = useCallback(
        (reason: LocationChangeReason, update: (history: History) => History) => {
            const now = latest.current;
            const from = now.asked?.history ?? now.history;
            const to = update(from);

            if (to === from) {
                return;
            }

            const moved = !equalPlace(currentOf(to), currentOf(from));
            let next: HistoryState;

            if (!controlled) {
                next = { ...now, history: to, reason: moved ? reason : now.reason };
            } else if (moved || now.asked) {
                next = { ...now, asked: { history: to, reason: moved ? reason : (now.asked?.reason ?? reason) } };
            } else {
                next = { ...now, history: to };
            }

            latest.current = next;
            setState(next);

            if (moved) {
                onChangeRef.current?.(currentOf(to), reason);
            }
        },
        [controlled],
    );

    const navigate = useCallback(
        (place: FileManagerLocation) => change("navigate", (history) => pushed(history, place)),
        [change],
    );

    const back = useCallback(() => change("back", (history) => stepped(history, -1)), [change]);

    const forward = useCallback(() => change("forward", (history) => stepped(history, 1)), [change]);

    /** Rewrites every place, the current one included, e.g. after a folder on their trails was renamed. */
    const revise = useCallback(
        (update: ReviseLocation) => change("replace", (history) => revised(history, update)),
        [change],
    );

    const { history, reason } = shown;

    return {
        place: currentOf(history),
        /** Why the current place last changed. */
        reason,
        /** Where `back` goes, if anywhere. */
        previous: history.places[history.index - 1] as FileManagerLocation | undefined,
        /** Where `forward` goes, if anywhere. */
        next: history.places[history.index + 1] as FileManagerLocation | undefined,
        canGoBack: history.index > 0,
        canGoForward: history.index < history.places.length - 1,
        navigate,
        back,
        forward,
        revise,
    };
};
