import type { IconSource } from "./icon";

/** An item of the sidebar's main menu, for what belongs to the app rather than to entries. */
export interface MainMenuItem {
    id: string;
    label: string;
    icon?: IconSource;
    /**
     * Shown beside the label, e.g. "Ctrl+,", and bound to the keyboard anywhere in the file
     * manager, as an action's `shortcut` is, except that a key typing into the search field is
     * left to it unless Ctrl or Alt is held.
     */
    shortcut?: string;
    disabled?: boolean;
    onSelect: () => void;
}

/** Items of the main menu shown together, divided from the next group by a rule. */
export interface MainMenuGroup {
    id: string;
    items: MainMenuItem[];
}
