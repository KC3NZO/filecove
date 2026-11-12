import { useCallback, useLayoutEffect, useRef } from "react";

import { useSetting } from "./use-setting";

import type { MediaSearch } from "../types";

interface MediaSearchOptions {
    /** Names the component in the warnings about switching between controlled and not. */
    component: string;
    /** The app's search, when it keeps it: null while closed. */
    value?: MediaSearch | null;
    /** Where it starts, while the app doesn't keep it. */
    defaultValue?: MediaSearch | null;
    /** Told the search as it opens, as what's typed changes, and as it closes. */
    onChange?: (search: MediaSearch | null) => void;
}

const sameSearch = (a: MediaSearch | null, b: MediaSearch | null) =>
    a === b || (!!a && !!b && a.query === b.query);

/**
 * The search of a media library's header, the media manager's and the picker's: open or not, and what's
 * typed, as one value the app may keep (`MediaSearch`, null while closed), and giving the focus to it and
 * back, as the file manager's search does. Opening it focuses the field, or, open already, selects what's
 * typed; closing it with the focus in the field gives the focus back to what had it, or else to the
 * search button. A change the app keeps is only asked for, and the field is focused once it shows.
 */
export const useMediaSearch = ({ component, value, defaultValue = null, onChange }: MediaSearchOptions) => {
    const [search, setSearch] = useSetting<MediaSearch | null>({
        name: "search",
        component,
        value,
        defaultValue,
        onChange,
        equal: sameSearch,
    });
    const query = search?.query ?? "";
    const searching = search !== null;
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    // What had the focus as the search opened, to give it back to as it closes.
    const searchOpenerRef = useRef<HTMLElement | null>(null);
    // Asks the field to take the focus once it's there, as it's only drawn by the render that follows.
    const focusSearchAsked = useRef(false);

    useLayoutEffect(() => {
        if (focusSearchAsked.current) {
            focusSearchAsked.current = false;
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
        }
    });

    // What's typed, while it's open.
    const setQuery = useCallback(
        (typed: string) => setSearch((current) => (current ? { ...current, query: typed } : current)),
        [setSearch],
    );

    /** Opens it, with `typed` in it, or what's typed staying. */
    const openSearch = (typed?: string) => {
        if (!searching) {
            searchOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }

        focusSearchAsked.current = true;
        setSearch((current) => ({ ...current, query: typed ?? current?.query ?? "" }));

        const input = searchInputRef.current;

        if (input) {
            focusSearchAsked.current = false;
            input.focus();
            input.select();
        }
    };

    const stopSearching = useCallback(() => {
        setSearch(null);
        searchOpenerRef.current = null;
    }, [setSearch]);

    const closeSearch = () => {
        const opener = searchOpenerRef.current;

        if (searchInputRef.current?.closest('[role="search"]')?.contains(document.activeElement)) {
            if (opener && opener !== document.body) {
                opener.focus();
            }

            if (document.activeElement !== opener) {
                searchButtonRef.current?.focus();
            }
        }

        stopSearching();
    };

    return {
        search,
        query,
        setQuery,
        searching,
        searchInputRef,
        searchButtonRef,
        openSearch,
        stopSearching,
        closeSearch,
    };
};
