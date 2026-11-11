import { useCallback, useEffect, useState } from "react";

import { childId } from "../mocks/mock-adapter";

import type { MediaLocation, MediaLocationChangeReason, MediaSection } from "../../src";

// The media manager's location in the URL's hash, as "#audio/The Harbour Hour/Season 1", so a reload
// or a link opens the same group, and the browser's back and forward buttons go through the groups
// visited. The mock's ids are full paths, so the trail is rebuilt from the names, each group known only
// by its id and name, as an app reading its URL would; with opaque ids, an app would keep the ids.

const format = (location: MediaLocation | null) =>
    location
        ? `#${[location.sectionId, ...location.trail.map((group) => group.name)].map(encodeURIComponent).join("/")}`
        : "";

/** The location a hash names, or null, the first library's root, for one naming none or one not known. */
const parse = (hash: string, sections: readonly MediaSection[]): MediaLocation | null => {
    try {
        const [sectionId, ...names] = hash.replace(/^#/, "").split("/").filter(Boolean).map(decodeURIComponent);
        const section = sections.find((candidate) => candidate.id === sectionId);
        let parentId = section?.rootId ?? "";

        return section
            ? {
                  sectionId: section.id,
                  trail: names.map((name) => {
                      parentId = childId(parentId, name);

                      return { id: parentId, name, kind: "folder" as const };
                  }),
              }
            : null;
    } catch {
        // A hash that isn't a location, such as one with a stray "%".
        return null;
    }
};

/** Where the page opened, for `?uncontrolled`, which starts there and keeps it itself. */
export const locationInHash = (sections: readonly MediaSection[]) => parse(window.location.hash, sections);

/**
 * The location for a controlled media manager, kept in the URL's hash, and the `onLocationChange` that
 * keeps it there: a place gone to is pushed as a new entry of the browser's history, and one rewritten
 * in place ("replace", a group renamed or gone) replaces its entry. The browser's back and forward pass
 * the location from the hash back, which the media manager takes as the app's own change, closing what
 * was over the library. What it's handed is kept as it is, groups and all, until then.
 */
export const useMediaLocation = (sections: readonly MediaSection[]) => {
    const [location, setLocation] = useState(() => locationInHash(sections));

    useEffect(() => {
        const follow = () => setLocation(locationInHash(sections));

        window.addEventListener("popstate", follow);

        return () => window.removeEventListener("popstate", follow);
    }, [sections]);

    const change = useCallback((next: MediaLocation, reason: MediaLocationChangeReason) => {
        const url = format(next);

        if (url !== window.location.hash) {
            if (reason === "replace") {
                history.replaceState(null, "", url);
            } else {
                history.pushState(null, "", url);
            }
        }

        setLocation(next);
    }, []);

    return [location, change] as const;
};
