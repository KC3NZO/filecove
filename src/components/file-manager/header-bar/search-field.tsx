import type { FocusEvent, KeyboardEvent, RefObject } from "react";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { focusOutline } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import Icon from "../../icons/icon";

interface SearchFieldProps {
    query: string;
    /** The name of the folder searched in. */
    scope: string;
    inputRef: RefObject<HTMLInputElement | null>;
    onQueryChange: (query: string) => void;
    /** Escape, or ✕ with nothing typed, which give the focus back. */
    onClose: () => void;
    /** The focus going elsewhere with nothing typed, where it stays. */
    onDismiss: () => void;
    /** Down or Enter, on to the content. */
    onFocusContent: () => void;
}

// The path bar's shape, in its place, so the header doesn't move as one swaps for the other.
const fieldSx: SxProps<Theme> = {
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

/** The search field, shown in the path bar's place while searching. */
const SearchField = ({
    query,
    scope,
    inputRef,
    onQueryChange,
    onClose,
    onDismiss,
    onFocusContent,
}: SearchFieldProps) => {
    const { text } = useLocale();

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

        if (!plain || event.nativeEvent.isComposing) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
        } else if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            onFocusContent();
        }
    };

    // Left with nothing typed, the field gives the path bar back. It's checked once the focus has
    // gone, so the window losing it, which leaves the field focused, doesn't count.
    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
        const input = event.currentTarget;

        if (!input.value) {
            setTimeout(() => {
                if (input.isConnected && !input.value && document.activeElement !== input) {
                    onDismiss();
                }
            });
        }
    };

    return (
        <Box role="search" sx={fieldSx}>
            <Icon name="search" fontSize="small" />
            <InputBase
                inputRef={inputRef}
                type="search"
                value={query}
                placeholder={text.searchIn(isolate(scope))}
                autoComplete="off"
                spellCheck={false}
                sx={inputSx}
                slotProps={{ input: { "aria-label": text.search } }}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
            />
            {/* Keeps the focus in the field as it's pressed, so it clears what's typed without
                losing it, or closes the search with the field as the place to go back from. */}
            <IconButton
                size="small"
                aria-label={query ? text.clearSearch : text.closeSearch}
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
            </IconButton>
        </Box>
    );
};

export default SearchField;
