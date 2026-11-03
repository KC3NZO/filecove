import type { FocusEvent, KeyboardEvent, Ref, RefObject } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { startIconSx } from "../../styles/direction";
import { headerFieldSx, headerInputSx } from "../../styles/header-field";
import { HEADER_HEIGHT } from "../../styles/layout";
import { mediaMedium } from "../../styles/media-layout";
import { forcedColors, forcedPressed } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import GroupPath from "./group-path";

import type { FileEntry, MediaLayout, MediaSection } from "../../types";

interface MediaHeaderProps {
    section: MediaSection | undefined;
    /** The groups gone into from the library's root, to the one open; none at its root. */
    trail: readonly FileEntry[];
    /** Goes to the level with that many groups of the trail open. */
    onGoToLevel: (depth: number) => void;
    /** Whether the button going up a level is shown, which it isn't while something's in the library's place. */
    showsLevelUp: boolean;
    levelUpRef: Ref<HTMLButtonElement>;
    /** Whether there's more than one library, to choose among from a drawer where the list doesn't dock. */
    several: boolean;
    /** Whether that drawer is open. */
    librariesOpen: boolean;
    librariesOpenerRef: Ref<HTMLButtonElement>;
    onOpenLibraries: () => void;
    /** Whether the search can be used, which it can't while something else is in the library's place. */
    searchable: boolean;
    /** Whether the search field is open, in place of the library's name. */
    searching: boolean;
    query: string;
    searchInputRef: RefObject<HTMLInputElement | null>;
    searchButtonRef: Ref<HTMLButtonElement>;
    onQueryChange: (query: string) => void;
    /** The search button: opens the field, or closes it when it's open. */
    onToggleSearch: () => void;
    /** Escape, or ✕ with nothing typed, which give the focus back. */
    onCloseSearch: () => void;
    /** The focus going elsewhere with nothing typed, where it stays. */
    onDismissSearch: () => void;
    /** Down or Enter in the field, on to the assets. */
    onFocusAssets: () => void;
    /** The layout its button switches to, while the library offers another. */
    otherLayout: MediaLayout | undefined;
    onSwitchLayout: () => void;
    /** Opens or closes the field asking a new group's name; missing while none can be made here. */
    onNewGroup: (() => void) | undefined;
    /** What it's named: the library's form's title for a new group, or else the media manager's. */
    newGroupLabel: string;
    /** Whether that field, or that form, is open. */
    creatingGroup: boolean;
    newGroupRef: Ref<HTMLButtonElement>;
    /** Picks files to upload into the level open; missing while it takes none. */
    onUpload: (() => void) | undefined;
    uploadRef: Ref<HTMLButtonElement>;
}

const headerSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    px: 1,
    pb: 0.75,
};

const barSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minHeight: HEADER_HEIGHT,
};

const titleSx: SxProps<Theme> = {
    flexShrink: 1,
    minWidth: 0,
    px: 1,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

// Opens the drawer of libraries, where the list doesn't dock; from `mediaMedium` it's docked.
const librariesButtonSx: SxProps<Theme> = {
    [mediaMedium]: { display: "none" },
};

// The name, or the search field in its place, filling the room up to the buttons, so they never move.
const nameSlotSx: SxProps<Theme> = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    minWidth: 0,
};

// The search's, and New group's: `primary` while what it opens is open.
const toggleButtonSx: SxProps<Theme> = {
    '&[aria-pressed="true"]': { color: "primary.main" },
    [forcedColors]: forcedPressed,
};

const uploadSx: SxProps<Theme> = {
    flexShrink: 0,
    ...startIconSx,
};

/**
 * Above the library: the button opening the libraries where they don't dock, inside a group the
 * button going up a level, its name, or the path to the group open, or the search field in its place
 * while searching, the button opening that, the button switching its layout, while
 * it offers another, New group, while one can be made here, and Upload, while it takes files.
 */
const MediaHeader = ({
    section,
    trail,
    onGoToLevel,
    showsLevelUp,
    levelUpRef,
    several,
    librariesOpen,
    librariesOpenerRef,
    onOpenLibraries,
    searchable,
    searching,
    query,
    searchInputRef,
    searchButtonRef,
    onQueryChange,
    onToggleSearch,
    onCloseSearch,
    onDismissSearch,
    onFocusAssets,
    otherLayout,
    onSwitchLayout,
    onNewGroup,
    newGroupLabel,
    creatingGroup,
    newGroupRef,
    onUpload,
    uploadRef,
}: MediaHeaderProps) => {
    const { text } = useLocale();
    const inGroup = trail.length > 0;
    // What's open: the search goes through this, and a level up goes to the one before.
    const levelName = trail.at(-1)?.name ?? section?.label ?? "";
    const parentName = trail.at(-2)?.name ?? section?.label ?? "";

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

        if (plain && !event.nativeEvent.isComposing && (event.key === "ArrowDown" || event.key === "Enter")) {
            event.preventDefault();
            onFocusAssets();
        }
    };

    // Stopped here, so an app's dialog around the media manager doesn't close with it.
    const handleFieldKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.stopPropagation();
            onCloseSearch();
        }
    };

    // Left with nothing typed, the field gives the name back. It's checked once the focus has gone,
    // so the window losing it, which leaves it where it was, doesn't count, nor does the focus moving
    // between the field's own parts.
    const handleFieldBlur = (event: FocusEvent<HTMLDivElement>) => {
        const field = event.currentTarget;

        if (!query) {
            setTimeout(() => {
                if (field.isConnected && !searchInputRef.current?.value && !field.contains(document.activeElement)) {
                    onDismissSearch();
                }
            });
        }
    };

    return (
        <Box component="header" sx={headerSx}>
            <Box sx={barSx}>
                {several && (
                    <TooltipIconButton
                        ref={librariesOpenerRef}
                        label={text.mediaChooseLibrary}
                        sx={librariesButtonSx}
                        aria-expanded={librariesOpen}
                        onClick={onOpenLibraries}
                    >
                        <Icon name="menu" fontSize="small" />
                    </TooltipIconButton>
                )}
                {inGroup && showsLevelUp && !searching && (
                    <TooltipIconButton
                        ref={levelUpRef}
                        label={text.mediaBackToLibrary(isolate(parentName))}
                        onClick={() => onGoToLevel(trail.length - 1)}
                    >
                        <Icon name="arrowBack" fontSize="small" />
                    </TooltipIconButton>
                )}
                <Box sx={nameSlotSx}>
                    {searching && section ? (
                        <Box role="search" sx={headerFieldSx} onKeyDown={handleFieldKeyDown} onBlur={handleFieldBlur}>
                            <Icon name="search" fontSize="small" />
                            <InputBase
                                inputRef={searchInputRef}
                                type="search"
                                value={query}
                                placeholder={text.searchIn(isolate(levelName))}
                                autoComplete="off"
                                spellCheck={false}
                                slotProps={{ input: { "aria-label": text.search } }}
                                sx={headerInputSx}
                                onChange={(event) => onQueryChange(event.target.value)}
                                onKeyDown={handleInputKeyDown}
                            />
                            {/* Keeps the focus in the field as it's pressed, so it clears what's typed
                                without losing it, or closes the search with the field as the place to go
                                back from. */}
                            <TooltipIconButton
                                size="small"
                                label={query ? text.clearSearch : text.closeSearch}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    if (query) {
                                        onQueryChange("");
                                        searchInputRef.current?.focus();
                                    } else {
                                        onCloseSearch();
                                    }
                                }}
                            >
                                <Icon name="close" fontSize="small" />
                            </TooltipIconButton>
                        </Box>
                    ) : inGroup && section ? (
                        <GroupPath label={section.label} trail={trail} onGoToLevel={onGoToLevel} />
                    ) : (
                        <Typography component="h2" noWrap sx={titleSx}>
                            {section?.label}
                        </Typography>
                    )}
                </Box>
                {/* Keeps the focus in an open search's field as it's pressed, which closes it. */}
                {searchable && (
                    <TooltipIconButton
                        ref={searchButtonRef}
                        label={text.search}
                        aria-pressed={searching}
                        aria-keyshortcuts="Control+F Meta+F"
                        sx={toggleButtonSx}
                        onMouseDown={(event) => searching && event.preventDefault()}
                        onClick={onToggleSearch}
                    >
                        <Icon name="search" fontSize="small" />
                    </TooltipIconButton>
                )}
                {otherLayout && (
                    <TooltipIconButton
                        label={otherLayout === "grid" ? text.gridView : text.listView}
                        onClick={onSwitchLayout}
                    >
                        <Icon name={otherLayout === "grid" ? "gridView" : "listView"} fontSize="small" />
                    </TooltipIconButton>
                )}
                {onNewGroup && (
                    <TooltipIconButton
                        ref={newGroupRef}
                        label={newGroupLabel}
                        aria-pressed={creatingGroup}
                        sx={toggleButtonSx}
                        onClick={onNewGroup}
                    >
                        <Icon name="newFolder" fontSize="small" />
                    </TooltipIconButton>
                )}
                {onUpload && (
                    <Button
                        ref={uploadRef}
                        color="inherit"
                        startIcon={<Icon name="upload" fontSize="small" />}
                        sx={uploadSx}
                        onClick={onUpload}
                    >
                        {text.upload}
                    </Button>
                )}
            </Box>
        </Box>
    );
};

export default MediaHeader;
