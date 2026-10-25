import { useCallback, useEffect, useRef, useState } from "react";

import { resultKey } from "../utils/search";

import type { FileAdapter, SearchHit, SearchTarget, SectionSearch } from "../types";

/** How long the typing has to stop for before a search everywhere runs by default, in ms. */
const SEARCH_DELAY = 300;

/**
 * How often, at most, a section's results show the pages that have come so far, in ms; the first
 * one shows at once. Every showing sorts all the results again.
 */
const PAGE_INTERVAL = 500;

/** A section's search under way, or done, and what it was asked for, to tell when that changes. */
interface Run {
    asked: string;
    adapter: FileAdapter;
    controller: AbortController;
}

const NO_SEARCHES: ReadonlyMap<string, SectionSearch> = new Map();
const NO_HITS: SearchHit[] = [];

/**
 * Searches every target's section for `query`, with its adapter's `search`, `delay` ms after the
 * typing stops, and again whenever `showHidden` or `version` changes, page after page until the
 * last. Each section is searched on its own, so one that's slow or fails holds up none of the
 * others. A section searched again keeps showing what it found before until its first page comes.
 */
export const useSearch = (
    targets: readonly SearchTarget[],
    query: string,
    showHidden: boolean,
    version: number,
    delay = SEARCH_DELAY,
) => {
    const [searches, setSearches] = useState(NO_SEARCHES);
    const runs = useRef(new Map<string, Run>());

    const update = useCallback((sectionId: string, search: SectionSearch | null) => {
        setSearches((prev) => {
            const next = new Map(prev);

            if (search) {
                next.set(sectionId, search);
            } else {
                next.delete(sectionId);
            }

            return next;
        });
    }, []);

    // Shows a section as being searched, with what it found before, until its first page comes.
    const markSearching = useCallback((sectionIds: readonly string[]) => {
        setSearches((prev) => {
            const next = new Map(prev);

            sectionIds.forEach((id) => next.set(id, { status: "searching", matches: prev.get(id)?.matches ?? NO_HITS }));

            return next;
        });
    }, []);

    // What a section is searched for, so a change to any of it searches again.
    const askedOf = useCallback(
        (target: SearchTarget) => JSON.stringify([query, showHidden, version, target.section.rootId]),
        [query, showHidden, version],
    );

    // Searches one section, aborting what it was searched for before.
    const start = useCallback(
        ({ section, adapter }: SearchTarget, asked: string) => {
            const controller = new AbortController();
            const { signal } = controller;
            const found = new Map<string, SearchHit>();
            let shownAt = 0;

            runs.current.get(section.id)?.controller.abort();
            runs.current.set(section.id, { asked, adapter, controller });

            const searchPage = (cursor?: string): Promise<void> =>
                Promise.resolve()
                    .then(() => adapter.search?.(section.rootId, query, { signal, cursor, showHidden }))
                    .then((result) => {
                        if (signal.aborted) {
                            return;
                        }

                        result?.matches.forEach(({ entry, trail, score }) => {
                            const key = resultKey(section.id, entry.id);

                            if (!found.has(key)) {
                                found.set(key, { key, section, adapter, trail, entry, score });
                            }
                        });

                        const nextCursor = result?.nextCursor;

                        if (nextCursor === undefined) {
                            update(section.id, { status: "ready", matches: [...found.values()] });

                            return;
                        }

                        if (nextCursor === cursor) {
                            throw new Error("The adapter's search returned the cursor it was given.");
                        }

                        if (shownAt === 0 || performance.now() - shownAt >= PAGE_INTERVAL) {
                            shownAt = performance.now();
                            update(section.id, { status: "searching", matches: [...found.values()] });
                        }

                        return searchPage(nextCursor);
                    });

            searchPage().catch((error: unknown) => {
                if (!signal.aborted) {
                    update(section.id, { status: "error", matches: [...found.values()], error });
                }
            });
        },
        [query, showHidden, update],
    );

    // Sections no longer searched are dropped. Those whose search changed are searched again once
    // the typing has stopped, aborting what they were searched for at once, so nothing stale comes.
    useEffect(() => {
        const wanted = new Set(targets.map((target) => target.section.id));

        runs.current.forEach((run, id) => {
            if (!wanted.has(id)) {
                run.controller.abort();
                runs.current.delete(id);
                update(id, null);
            }
        });

        const due = targets.filter((target) => {
            const run = runs.current.get(target.section.id);

            return !run || run.asked !== askedOf(target) || run.adapter !== target.adapter;
        });

        if (due.length === 0) {
            return;
        }

        due.forEach((target) => {
            runs.current.get(target.section.id)?.controller.abort();
            runs.current.delete(target.section.id);
        });
        markSearching(due.map((target) => target.section.id));

        const timer = setTimeout(() => due.forEach((target) => start(target, askedOf(target))), delay);

        return () => clearTimeout(timer);
    }, [targets, askedOf, start, update, markSearching, delay]);

    useEffect(() => {
        const current = runs.current;

        return () => {
            current.forEach((run) => run.controller.abort());
            current.clear();
        };
    }, []);

    /** Searches these sections again at once, e.g. those that failed. */
    const retry = useCallback(
        (sectionIds: readonly string[]) => {
            const again = targets.filter((target) => sectionIds.includes(target.section.id));

            markSearching(again.map((target) => target.section.id));
            again.forEach((target) => start(target, askedOf(target)));
        },
        [targets, askedOf, start, markSearching],
    );

    return { searches, retry };
};
