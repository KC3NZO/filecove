import { useCallback, useState } from "react";

/** A message for screen readers. `id` counts them, so the same message said twice is heard twice. */
export interface Announcement {
    message: string;
    id: number;
}

/**
 * What the file manager has to tell screen readers as an action finishes with nothing else spoken
 * about it, for `Announcer` to read out. A message announced before the last one is heard replaces it.
 */
export const useAnnouncer = () => {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);

    const announce = useCallback(
        (message: string) => setAnnouncement((prev) => ({ message, id: (prev?.id ?? 0) + 1 })),
        [],
    );

    return { announcement, announce };
};
