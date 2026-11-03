import { useLayoutEffect, useRef, useState } from "react";

/**
 * The search of a media library's header, the media manager's and the picker's: what's typed, whether
 * the field is open, and giving the focus to it and back, as the file manager's search does. Opening
 * it focuses the field, or, open already, selects what's typed; closing it with the focus in the field
 * gives the focus back to what had it, or else to the search button.
 */
export const useMediaSearch = () => {
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
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

    const openSearch = () => {
        if (!searching) {
            searchOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }

        focusSearchAsked.current = true;
        setSearching(true);

        const input = searchInputRef.current;

        if (input) {
            focusSearchAsked.current = false;
            input.focus();
            input.select();
        }
    };

    const stopSearching = () => {
        setSearching(false);
        setQuery("");
        searchOpenerRef.current = null;
    };

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
        query,
        setQuery,
        searching,
        setSearching,
        searchInputRef,
        searchButtonRef,
        openSearch,
        stopSearching,
        closeSearch,
    };
};
