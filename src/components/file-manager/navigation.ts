import { useCallback, useState } from "react";

import type { FolderRef, Place, Section } from "./types";

interface History {
    places: Place[];
    index: number;
}

/** The folder a place points at: the end of its trail, or the section root. */
export const folderOf = (section: Section, trail: FolderRef[]): FolderRef =>
    trail.at(-1) ?? { id: section.rootId, name: section.label };

const samePlace = (a: Place, b: Place) =>
    a.sectionId === b.sectionId &&
    a.trail.length === b.trail.length &&
    a.trail.every((folder, index) => folder.id === b.trail[index].id);

/** The current place, with browser-style back and forward history. */
export const usePlaceHistory = (initial: () => Place) => {
    const [history, setHistory] = useState<History>(() => ({ places: [initial()], index: 0 }));

    const navigate = useCallback((place: Place) => {
        setHistory((prev) =>
            samePlace(prev.places[prev.index], place)
                ? prev
                : { places: [...prev.places.slice(0, prev.index + 1), place], index: prev.index + 1 },
        );
    }, []);

    const back = useCallback(() => {
        setHistory((prev) => (prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev));
    }, []);

    const forward = useCallback(() => {
        setHistory((prev) => (prev.index < prev.places.length - 1 ? { ...prev, index: prev.index + 1 } : prev));
    }, []);

    return {
        place: history.places[history.index],
        canGoBack: history.index > 0,
        canGoForward: history.index < history.places.length - 1,
        navigate,
        back,
        forward,
    };
};
