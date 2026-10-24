import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Where a message is said from: the file manager's own region, or one inside the preview, since
 * a modal hides the rest of the page from screen readers while it's open.
 */
export type AnnouncerRegion = "root" | "preview";

/** A message for screen readers. `id` counts them, so the same message said twice is heard twice. */
export interface Announcement {
    message: string;
    id: number;
    region: AnnouncerRegion;
}

/**
 * What the file manager has to tell screen readers as an action finishes with nothing else spoken
 * about it, for `Announcer` to read out, from the region `regionOf` names as it's announced. A
 * message announced before the last one is heard replaces it.
 */
export const useAnnouncer = (regionOf: () => AnnouncerRegion = () => "root") => {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const latest = useRef(regionOf);

    useLayoutEffect(() => {
        latest.current = regionOf;
    });

    const announce = useCallback(
        (message: string) =>
            setAnnouncement((prev) => ({ message, id: (prev?.id ?? 0) + 1, region: latest.current() })),
        [],
    );

    return { announcement, announce };
};
