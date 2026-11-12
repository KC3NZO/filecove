import type { RefObject } from "react";

import { useLocale } from "../../../hooks/use-locale";
import Icon from "../../icons/icon";
import IconSlot from "../../icons/icon-slot";
import ButtonBase from "../../ui/button-base";
import { CheckMark } from "../../ui/checkbox";
import Menu, { MenuIcon, MenuItem, MenuLabel, MenuText } from "../../ui/menu";
import styles from "./search-sections-menu.module.css";

import type { SectionGroup } from "../../../types";

interface SearchSectionsMenuProps {
    groups: SectionGroup[];
    /** Ids of the sections left out of the search; never all of them. */
    excluded: ReadonlySet<string>;
    /** The open menu's button, and which way its text runs, read as it opened. */
    menu: SectionsMenu | null;
    buttonRef: RefObject<HTMLButtonElement | null>;
    onOpen: () => void;
    onClose: () => void;
    onExcludedChange: (excluded: ReadonlySet<string>) => void;
}

export interface SectionsMenu {
    anchor: HTMLElement;
    rtl: boolean;
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The search field's button for which sections a search everywhere covers, and its menu, which
 * stays open while sections are checked, so several can change in one go. One section always
 * stays checked. Pressing the button keeps the focus in the field until the menu takes it, and
 * the menu gives it back there.
 */
const SearchSectionsMenu = ({
    groups,
    excluded,
    menu,
    buttonRef,
    onOpen,
    onClose,
    onExcludedChange,
}: SearchSectionsMenuProps) => {
    const { text } = useLocale();
    const total = groups.reduce((count, group) => count + group.sections.length, 0);
    const checked = total - excluded.size;
    const all = excluded.size === 0;

    const toggle = (id: string) => {
        const next = new Set(excluded);

        if (!next.delete(id)) {
            next.add(id);
        }

        onExcludedChange(next);
    };

    return (
        <>
            <ButtonBase
                ref={buttonRef}
                aria-label={text.searchSections}
                aria-haspopup="menu"
                aria-expanded={!!menu}
                aria-keyshortcuts="Alt+ArrowDown"
                className={styles.button}
                onMouseDown={(event) => event.preventDefault()}
                onClick={onOpen}
            >
                {all ? text.allSections : text.sectionCount(checked)}
                <Icon name="expand" fontSize="small" />
            </ButtonBase>
            {/* Hangs from the button's end edge, as the view menu does: the field ends near the header's end. */}
            <Menu
                open={!!menu}
                anchor={menu?.anchor}
                rtl={menu?.rtl}
                align="end"
                onClose={onClose}
            >
                <MenuItem
                    role="menuitemcheckbox"
                    aria-checked={all ? true : "mixed"}
                    onClick={() => onExcludedChange(NONE)}
                >
                    <MenuIcon>
                        <CheckMark checked={all} indeterminate={!all} />
                    </MenuIcon>
                    <MenuText>{text.allSections}</MenuText>
                </MenuItem>
                {groups.flatMap((group) => [
                    group.title ? (
                        <MenuLabel key={`title-${group.id}`}>
                            {group.title}
                        </MenuLabel>
                    ) : null,
                    ...group.sections.map((section) => {
                        const on = !excluded.has(section.id);

                        return (
                            <MenuItem
                                key={section.id}
                                role="menuitemcheckbox"
                                aria-checked={on}
                                disabled={on && checked === 1}
                                onClick={() => toggle(section.id)}
                            >
                                <MenuIcon>
                                    <CheckMark checked={on} />
                                </MenuIcon>
                                {section.icon && (
                                    <span className={styles.sectionIcon}>
                                        <IconSlot icon={section.icon} />
                                    </span>
                                )}
                                <MenuText>
                                    <bdi>{section.label}</bdi>
                                </MenuText>
                            </MenuItem>
                        );
                    }),
                ])}
            </Menu>
        </>
    );
};

export default SearchSectionsMenu;
