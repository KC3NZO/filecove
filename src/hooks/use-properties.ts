import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { PropertiesCache } from "../store/properties-cache";
import type { CountTarget, EntryProperties, EntryTotals, PropertiesItem, Requested } from "../types";

const LOADING = { status: "loading" } as const;

// Numbers adapters by identity, so folders are told apart by their adapters in a key.
const identities = new WeakMap<object, number>();
let nextIdentity = 1;

const identityOf = (value: object) => {
    let identity = identities.get(value);

    if (identity === undefined) {
        identity = nextIdentity++;
        identities.set(value, identity);
    }

    return identity;
};

interface UsePropertiesOptions {
    cache: PropertiesCache;
    /**
     * The host's count of its changes, which counts what's in folders again once it has stopped
     * going up for a moment, keeping the totals counted before meanwhile.
     */
    changes: number;
    showHidden: boolean;
}

/**
 * What the adapters add to what the items' listings say: one item's properties, when its adapter
 * has `properties`, and what's in the items' folders, when every one of their adapters has
 * `measure`, both kept in `cache`. Undefined for what isn't asked for.
 */
export const useProperties = (
    items: readonly PropertiesItem[],
    { cache, changes, showHidden }: UsePropertiesOptions,
) => {
    useSyncExternalStore(cache.subscribe, cache.version);

    const [detailsAttempt, setDetailsAttempt] = useState(0);
    const [countAttempt, setCountAttempt] = useState(0);

    const [only] = items;
    const detailsEntry = items.length === 1 && only.adapter.properties ? only.entry : undefined;
    const detailsAdapter = only?.adapter;

    useEffect(
        () => (detailsEntry && detailsAdapter ? cache.wantDetails(detailsEntry, detailsAdapter) : undefined),
        [cache, detailsEntry, detailsAdapter, detailsAttempt],
    );

    const targets = useMemo<CountTarget[]>(
        () =>
            items
                .filter((item) => item.entry.kind === "folder")
                .map((item) => ({ entry: item.entry, adapter: item.adapter })),
        [items],
    );
    const measurable = targets.length > 0 && targets.every((target) => !!target.adapter.measure);
    // The same folders, by their ids and adapters, make the same key, however often the items are
    // made anew and the folders listed anew, so a count under way carries on.
    const countKey = measurable
        ? JSON.stringify(targets.map((target) => [identityOf(target.adapter), target.entry.id]))
        : "";

    useEffect(
        () => (countKey ? cache.wantCount(targets, changes, showHidden) : undefined),
        // `targets` is left out: it changes with `countKey`, and is made anew far more often.
        [cache, countKey, changes, showHidden, countAttempt],
    );

    const details: Requested<EntryProperties> | undefined =
        detailsEntry && detailsAdapter ? (cache.details(detailsEntry, detailsAdapter) ?? LOADING) : undefined;
    const totals: Requested<EntryTotals> | undefined = measurable
        ? (cache.count(targets, changes, showHidden) ?? LOADING)
        : undefined;

    const retryDetails = () => {
        if (detailsEntry && detailsAdapter) {
            cache.forgetDetails(detailsEntry, detailsAdapter);
            setDetailsAttempt((count) => count + 1);
        }
    };

    const retryTotals = () => {
        cache.forgetCount(targets, showHidden);
        setCountAttempt((count) => count + 1);
    };

    return { details, totals, retryDetails, retryTotals };
};
