import { useCallback, useEffect, useRef } from "react";

/** How long typing may pause before the next key starts a new query, in ms. */
const RESET_DELAY = 500;

/**
 * The characters typed in quick succession, for finding an entry or folder by the start of its
 * name. `type` adds one and returns the query so far; `typing` says whether a query is under way,
 * so a space can be part of it rather than selecting.
 */
export const useTypeAhead = () => {
    const query = useRef("");
    const timer = useRef(0);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const type = useCallback((char: string) => {
        window.clearTimeout(timer.current);
        query.current += char;
        timer.current = window.setTimeout(() => {
            query.current = "";
        }, RESET_DELAY);

        return query.current;
    }, []);

    const typing = useCallback(() => query.current !== "", []);

    return { type, typing };
};
