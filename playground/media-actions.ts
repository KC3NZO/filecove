import { reverseLevel } from "./mocks/mock-media";

import type { MediaActionGroup } from "../src";

// The header's actions (`MediaManager.actions`), as an app's would be: what the component leaves to it,
// done through its own API, the media manager listing again with `refresh()`.

const describeCount = (count: number) => (count === 1 ? "1 pick" : `${count} picks`);

export const createMediaActions = (notify: (message: string) => void): MediaActionGroup[] => [
    {
        id: "level",
        actions: [
            {
                // Inside a group, as the root keeps newest first, and not over an asset shown.
                id: "reverse",
                label: "Reverse this group's order",
                icon: "sort",
                shortcut: "Alt+R",
                visible: ({ group, viewed, readOnly }) => !!group && !viewed && !readOnly,
                onSelect: ({ group, refresh }) => {
                    if (group) {
                        reverseLevel(group.id);
                        refresh();
                    }
                },
            },
            {
                // Needs something selected, so it shows held until then.
                id: "share",
                label: "Share what's selected",
                icon: "share",
                disabled: ({ choices }) => choices.length === 0,
                onSelect: ({ choices }) => notify(`Shared ${describeCount(choices.length)}`),
            },
        ],
    },
    {
        id: "report",
        actions: [
            {
                // No icon, so it's in "More actions".
                id: "report",
                label: "Report a problem with this",
                destructive: true,
                visible: ({ viewed }) => !!viewed,
                onSelect: ({ viewed, section }) => notify(`Reported ${viewed?.entry.name} in ${section.label}`),
            },
        ],
    },
];
