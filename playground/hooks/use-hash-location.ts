import { useCallback, useEffect, useState } from "react";

import { childId } from "../mocks/mock-adapter";

import type { FileManagerLocation, LocationChangeReason, Section } from "../../src";

// The file manager's location in the URL's hash, as "#project-a/src/components", so a reload or a
// link opens the same folder, and the browser's back and forward buttons go through the folders
// visited. The mock's ids are full paths, so the trail is built from the names in the hash; with
// opaque ids, a consumer would keep the ids in the URL, or look the trail up from them.

const format = ({ sectionId, trail }: FileManagerLocation) =>
    `#${[sectionId, ...trail.map((folder) => folder.name)].map(encodeURIComponent).join("/")}`;

const parse = (hash: string, sections: Section[]): FileManagerLocation | undefined => {
    try {
        const [sectionId, ...names] = hash.replace(/^#/, "").split("/").filter(Boolean).map(decodeURIComponent);
        const section = sections.find((candidate) => candidate.id === sectionId);
        let parentId = section?.rootId ?? "";

        return (
            section && {
                sectionId: section.id,
                trail: names.map((name) => {
                    parentId = childId(parentId, name);

                    return { id: parentId, name };
                }),
            }
        );
    } catch {
        // A hash that isn't a location, such as one with a stray "%".
        return undefined;
    }
};

// Where a hash with no location, or one the playground doesn't know, leads: the first section's
// root, where the file manager opens by default.
const home = (sections: Section[]): FileManagerLocation => ({ sectionId: sections[0]?.id ?? "", trail: [] });

const fromHash = (sections: Section[]) => parse(window.location.hash, sections) ?? home(sections);

/**
 * The location for a controlled file manager, kept in the URL's hash, and the `onLocationChange`
 * that keeps it there: a place gone to is pushed as a new entry of the browser's history, and one
 * rewritten in place replaces its entry. Going back or forward in the file manager pushes one too,
 * rather than moving through the browser's history, which may hold pages before this one; the
 * browser's own buttons then lead where the file manager's do.
 */
export const useHashLocation = (sections: Section[]) => {
    const [location, setLocation] = useState(() => fromHash(sections));

    // The browser's back and forward buttons, and a hash edited by hand. An entry whose hash has no
    // location, as the one the page opened on may have, or one the playground doesn't know, shows
    // the first section's root, and its hash is put right, so going back to it leads there again.
    useEffect(() => {
        const settle = () => {
            const shown = fromHash(sections);
            const url = format(shown);

            if (url !== window.location.hash && !parse(window.location.hash, sections)) {
                history.replaceState(null, "", url);
            }

            return shown;
        };

        const follow = () => setLocation(settle());

        settle();
        window.addEventListener("popstate", follow);

        return () => window.removeEventListener("popstate", follow);
    }, [sections]);

    const change = useCallback((next: FileManagerLocation, reason: LocationChangeReason) => {
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
