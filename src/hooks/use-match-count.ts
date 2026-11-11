import { useEffect, useRef } from "react";

/**
 * Says how many a media library's search found, as the file manager's folder search does, through
 * `announce`: once what's typed has been answered (`count` set), and again for each new query, not as a
 * search asked again after a change finds more or fewer, which would cut off what that change said.
 * Closing the search, or typing nothing, forgets it, so the same query searched again is said again.
 */
export const useMatchCount = (
    query: string,
    count: number | null,
    announce: (message: string) => void,
    textOf: (count: number) => string,
) => {
    const saidFor = useRef<string | null>(null);
    const asked = query.trim();

    useEffect(() => {
        if (asked === "") {
            saidFor.current = null;

            return;
        }

        if (count === null || saidFor.current === asked) {
            return;
        }

        saidFor.current = asked;
        announce(textOf(count));
    }, [asked, count, announce, textOf]);
};
