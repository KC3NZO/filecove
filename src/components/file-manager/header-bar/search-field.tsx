import { useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, RefObject } from "react";

import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { focusOutline } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import { isRtl } from "../../../utils/dom";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import SearchSectionsMenu from "./search-sections-menu";

import type { SearchScope, SectionGroup } from "../../../types";
import type { SectionsMenu } from "./search-sections-menu";

interface SearchFieldProps {
    scope: SearchScope;
    query: string;
    /** The name of the open folder, which a folder search covers. */
    folderName: string;
    /** Every section, which a search everywhere covers but for those `excluded`. */
    groups: SectionGroup[];
    /** Ids of the sections a search everywhere leaves out; never all of them. */
    excluded: ReadonlySet<string>;
    inputRef: RefObject<HTMLInputElement | null>;
    onQueryChange: (query: string) => void;
    onExcludedChange: (excluded: ReadonlySet<string>) => void;
    /** Escape, or ✕ with nothing typed, which give the focus back. */
    onClose: () => void;
    /** The focus going elsewhere with nothing typed, where it stays. */
    onDismiss: () => void;
    /** Down or Enter, on to the content. */
    onFocusContent: () => void;
}

// The path bar's shape, in its place, so the header doesn't move as one swaps for the other.
const fieldSx: SxProps<Theme> = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    minWidth: 0,
    height: 34,
    paddingInlineStart: 1.25,
    paddingInlineEnd: 0.25,
    borderRadius: 2,
    bgcolor: "action.hover",
    color: "text.secondary",
    "&:has(input:focus)": focusOutline,
};

// The browser's own clear button is left out, for the ✕ beside it. Each line of the query runs the
// way its own letters do, or else the way the page does.
const inputSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    color: "text.primary",
    fontSize: "0.875rem",
    "& input": { unicodeBidi: "plaintext" },
    "& input::-webkit-search-cancel-button, & input::-webkit-search-decoration": { appearance: "none" },
};

/**
 * The search field, shown in the path bar's place while searching, the open folder or every
 * section checked in its sections menu.
 */
const SearchField = ({
    scope,
    query,
    folderName,
    groups,
    excluded,
    inputRef,
    onQueryChange,
    onExcludedChange,
    onClose,
    onDismiss,
    onFocusContent,
}: SearchFieldProps) => {
    const { text } = useLocale();
    const [menu, setMenu] = useState<SectionsMenu | null>(null);
    const sectionsButtonRef = useRef<HTMLButtonElement>(null);
    const sections = groups.flatMap((group) => group.sections);
    const searched = sections.filter((section) => !excluded.has(section.id));
    const choosesSections = scope === "everywhere" && sections.length > 1;

    let placeholder = text.searchIn(isolate(folderName));

    if (scope === "everywhere") {
        placeholder =
            searched.length === sections.length
                ? text.searchEverywhere
                : searched.length === 1
                  ? text.searchIn(isolate(searched[0].label))
                  : text.searchInSections(searched.length);
    }

    const openMenu = () => {
        const button = sectionsButtonRef.current;

        if (button) {
            setMenu({ anchor: button, rtl: isRtl(button) });
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const others = event.ctrlKey || event.metaKey || event.shiftKey;

        if (event.nativeEvent.isComposing) {
            return;
        }

        // Alt+Down opens the sections menu, as it opens a combobox's list.
        if (event.key === "ArrowDown" && event.altKey && !others && choosesSections) {
            event.preventDefault();
            openMenu();
        } else if (others || event.altKey) {
            return;
        } else if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            onFocusContent();
        }
    };

    // Escape closes the search from any part of the field, but not from the sections menu, which
    // portals out and closes itself, though its presses still bubble here through React's tree.
    const handleFieldKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

        if (
            event.key === "Escape" &&
            plain &&
            !event.defaultPrevented &&
            !event.nativeEvent.isComposing &&
            event.target instanceof Node &&
            event.currentTarget.contains(event.target)
        ) {
            event.preventDefault();
            onClose();
        }
    };

    // Left with nothing typed, the field gives the path bar back. It's checked once the focus has
    // gone, so the window losing it, which leaves it where it was, doesn't count, nor does the
    // focus moving between the field's own parts or through the sections menu, which portals out
    // but whose blurs still bubble here through React's tree.
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const field = event.currentTarget;

        if (!query) {
            setTimeout(() => {
                const input = inputRef.current;

                if (
                    field.isConnected &&
                    !input?.value &&
                    !field.contains(document.activeElement) &&
                    !menu
                ) {
                    onDismiss();
                }
            });
        }
    };

    return (
        <Box role="search" sx={fieldSx} onKeyDown={handleFieldKeyDown} onBlur={handleBlur}>
            <Icon name={scope === "folder" ? "searchFolder" : "search"} fontSize="small" />
            <InputBase
                inputRef={inputRef}
                type="search"
                value={query}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                sx={inputSx}
                slotProps={{ input: { "aria-label": text.search } }}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={handleKeyDown}
            />
            {choosesSections && (
                <SearchSectionsMenu
                    groups={groups}
                    excluded={excluded}
                    menu={menu}
                    buttonRef={sectionsButtonRef}
                    onOpen={openMenu}
                    onClose={() => setMenu(null)}
                    onExcludedChange={onExcludedChange}
                />
            )}
            {/* Keeps the focus in the field as it's pressed, so it clears what's typed without
                losing it, or closes the search with the field as the place to go back from. */}
            <TooltipIconButton
                size="small"
                label={query ? text.clearSearch : text.closeSearch}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                    if (query) {
                        onQueryChange("");
                        inputRef.current?.focus();
                    } else {
                        onClose();
                    }
                }}
            >
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
        </Box>
    );
};

export default SearchField;
