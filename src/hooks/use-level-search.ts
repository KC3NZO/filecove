import { useCallback, useMemo } from "react";

import { isHidden } from "../utils/hidden";
import { useSearch } from "./use-search";

import type { FileAdapter, FolderRef, MediaSection, SearchHit, SearchTarget } from "../types";

const NO_TARGETS: readonly SearchTarget[] = [];
const NO_HITS: SearchHit[] = [];
const NO_TRAILS: ReadonlyMap<string, readonly FolderRef[]> = new Map();

/**
 * A media library's search through its adapter's `search`, the media manager's and the picker's: the
 * open level and everything below it, what's typed trimmed, a moment after the typing stops, and again
 * as `changes` does, `delay` ms after it stops (the default when undefined). `on` is false without an
 * adapter's `search` or with nothing typed, when the level is only filtered by name as it's listed. The matches are in the backend's order, so one coming on a
 * later page doesn't move those before it, and `trails` has the groups between the level and each that's
 * below it, by its id.
 */
export const useLevelSearch = (
    section: MediaSection | undefined,
    adapter: FileAdapter,
    levelId: string,
    query: string,
    changes: number,
    delay?: number,
) => {
    const asked = query.trim();
    const on = !!section && !!adapter.search && asked !== "";
    const targets = useMemo(
        () => (on && section ? [{ section: { ...section, rootId: levelId }, adapter }] : NO_TARGETS),
        [on, section, levelId, adapter],
    );
    const { searches, retry: retrySections } = useSearch(targets, asked, false, changes, delay);
    const run = on && section ? searches.get(section.id) : undefined;
    const matches = run?.matches;

    const hits = useMemo(() => (matches ?? NO_HITS).filter(({ entry }) => !isHidden(entry)), [matches]);

    const trails = useMemo(() => {
        const below = hits.filter(({ trail }) => trail.length > 0);

        return below.length > 0 ? new Map(below.map(({ entry, trail }) => [entry.id, trail])) : NO_TRAILS;
    }, [hits]);

    const sectionId = section?.id;

    const retry = useCallback(() => {
        if (sectionId !== undefined) {
            retrySections([sectionId]);
        }
    }, [sectionId, retrySections]);

    // Nothing having come back yet is searching.
    const status = run?.status ?? "searching";

    return {
        on,
        /** How it stands while it's on, as the grid goes by it; the bar shows over any found so far. */
        status: status === "searching" ? ("loading" as const) : status,
        searching: status === "searching",
        error: run?.error,
        hits,
        trails,
        retry,
    };
};
