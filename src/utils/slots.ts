import type { SlotAttributesOf } from "../types";

/**
 * A part's handler with the app's from `slotProps` before it (see `SlotAttributes`): the app's runs
 * first, and the part's only when the app's didn't call `preventDefault`, as the root's handlers go.
 * An event prevented already, by something inside the part, still reaches the part's own. Without
 * the app's, it's the part's own as it is, so nothing changes for a part no app aims at.
 */
export const chain = <E extends { defaultPrevented: boolean }>(
    theirs: ((event: E) => void) | undefined,
    ours: ((event: E) => void) | undefined,
): ((event: E) => void) | undefined => {
    if (!theirs || !ours) {
        return theirs ?? ours;
    }

    return (event) => {
        const prevented = event.defaultPrevented;

        theirs(event);

        if (prevented || !event.defaultPrevented) {
            ours(event);
        }
    };
};

/**
 * The attributes of one of a part there are many of, from `slotProps`: the same for each, or what
 * the app's function gives this one, its params made only when there's a function to hand them to.
 */
export const slotAttributesFor = <P>(slot: SlotAttributesOf<P> | undefined, params: () => P) =>
    typeof slot === "function" ? slot(params()) : slot;
