import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";

import { visuallyHiddenSx } from "../../styles/mixins";

import type { Announcement } from "../../hooks/use-announcer";

// How long a message stays in the region once said, so browse mode doesn't come across old ones.
const CLEAR_AFTER = 7000;

const hiddenFromReaders = (element: Element) => !!element.closest('[aria-hidden="true"]');

interface AnnouncerProps {
    announcement: Announcement | null;
}

/**
 * The file manager's polite live region, for what finishes with nothing else spoken about it.
 *
 * A modal dialog hides the rest of the page from screen readers (`aria-hidden` on `<body>`'s other
 * children) until it has faded out, and a live region in a hidden part goes unheard, so a message
 * the dialog's action ends with waits until the region is no longer hidden. Each message goes in a
 * node of its own, so the same message twice is a change too.
 */
const Announcer = ({ announcement }: AnnouncerProps) => {
    const regionRef = useRef<HTMLDivElement>(null);
    const [said, setSaid] = useState<Announcement | null>(null);

    useEffect(() => {
        const region = regionRef.current;

        if (!announcement || !region) {
            return;
        }

        let timer: number | undefined;

        const say = () => {
            setSaid(announcement);
            timer = window.setTimeout(() => setSaid(null), CLEAR_AFTER);
        };

        if (!hiddenFromReaders(region)) {
            say();

            return () => window.clearTimeout(timer);
        }

        const observer = new MutationObserver(() => {
            if (!hiddenFromReaders(region)) {
                observer.disconnect();
                say();
            }
        });

        observer.observe(region.ownerDocument.documentElement, {
            attributes: true,
            attributeFilter: ["aria-hidden"],
            subtree: true,
        });

        return () => {
            observer.disconnect();
            window.clearTimeout(timer);
        };
    }, [announcement]);

    return (
        <Box ref={regionRef} sx={visuallyHiddenSx} role="status">
            {said && <span key={said.id}>{said.message}</span>}
        </Box>
    );
};

export default Announcer;
