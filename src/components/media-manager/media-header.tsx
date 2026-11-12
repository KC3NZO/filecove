import type { FocusEvent, KeyboardEvent, Ref, RefObject } from "react";

import { useLocale } from "../../hooks/use-locale";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import headerField from "../../styles/header-field.module.css";
import { isolate } from "../../utils/bidi";
import ToolbarActions from "../buttons/toolbar-actions";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import Button from "../ui/button";
import Text from "../ui/text";
import GroupPath from "./group-path";
import styles from "./media-header.module.css";

import type { FileEntry, MediaLayout, MediaSection, ToolbarGroup } from "../../types";

interface MediaHeaderProps {
    section: MediaSection | undefined;
    /** The groups gone into from the library's root, to the one open; none at its root. */
    trail: readonly FileEntry[];
    /** Goes to the level with that many groups of the trail open. */
    onGoToLevel: (depth: number) => void;
    /** Opens the details of the group open; missing at the root, and while something's in the library's place. */
    onGroupDetails: (() => void) | undefined;
    groupDetailsRef: Ref<HTMLButtonElement>;
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
    /**
     * The app's actions for what's shown, bound to it; none while a step is in the library's place,
     * and none in the picker, which has nothing for managing a library.
     */
    actions?: readonly ToolbarGroup[];
    /** Picks files to upload into the level open; missing while it takes none. */
    onUpload: (() => void) | undefined;
    uploadRef: Ref<HTMLButtonElement>;
}

/** How many of the app's actions with icons show as buttons, where there's room for any. */
const INLINE_ACTIONS = 2;

const NO_ACTIONS: readonly ToolbarGroup[] = [];

/**
 * Above the library: the button opening the libraries where they don't dock, its name, or the path
 * to the group open, each step of it going back there, or the search field in its place while
 * searching, the button opening that, the button switching its layout, while it offers another, the
 * details of the group open, New group, while one can be made here, the app's actions, and Upload, while
 * it takes files.
 */
const MediaHeader = ({
    section,
    trail,
    onGoToLevel,
    onGroupDetails,
    groupDetailsRef,
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
    actions = NO_ACTIONS,
    onUpload,
    uploadRef,
}: MediaHeaderProps) => {
    const { text } = useLocale();
    const inGroup = trail.length > 0;
    // What's open: the search goes through this, and a level up goes to the one before.
    const levelName = trail.at(-1)?.name ?? section?.label ?? "";

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
        <header className={cx(styles.header, fmClasses.mediaHeader)}>
            <div className={styles.bar}>
                {several && (
                    <TooltipIconButton
                        ref={librariesOpenerRef}
                        label={text.mediaChooseLibrary}
                        className={styles.librariesButton}
                        aria-expanded={librariesOpen}
                        onClick={onOpenLibraries}
                    >
                        <Icon name="menu" fontSize="small" />
                    </TooltipIconButton>
                )}
                <div className={styles.nameSlot}>
                    {searching && section ? (
                        <div role="search" className={cx(headerField.field, fmClasses.searchField)} onKeyDown={handleFieldKeyDown} onBlur={handleFieldBlur}>
                            <Icon name="search" fontSize="small" />
                            <input
                                ref={searchInputRef}
                                type="search"
                                value={query}
                                placeholder={text.searchIn(isolate(levelName))}
                                autoComplete="off"
                                spellCheck={false}
                                aria-label={text.search}
                                className={headerField.input}
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
                        </div>
                    ) : inGroup && section ? (
                        <GroupPath label={section.label} trail={trail} onGoToLevel={onGoToLevel} />
                    ) : (
                        <Text component="h2" noWrap className={styles.title}>
                            {section?.label}
                        </Text>
                    )}
                </div>
                {/* Keeps the focus in an open search's field as it's pressed, which closes it. */}
                {searchable && (
                    <TooltipIconButton
                        ref={searchButtonRef}
                        label={text.search}
                        aria-pressed={searching}
                        aria-keyshortcuts="Control+F Meta+F"
                        className={styles.toggleButton}
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
                {inGroup && onGroupDetails && !searching && (
                    <TooltipIconButton
                        ref={groupDetailsRef}
                        label={text.mediaGroupDetails(isolate(levelName))}
                        onClick={onGroupDetails}
                    >
                        <Icon name="info" fontSize="small" />
                    </TooltipIconButton>
                )}
                {onNewGroup && (
                    <TooltipIconButton
                        ref={newGroupRef}
                        label={newGroupLabel}
                        aria-pressed={creatingGroup}
                        className={styles.toggleButton}
                        onClick={onNewGroup}
                    >
                        <Icon name="newFolder" fontSize="small" />
                    </TooltipIconButton>
                )}
                <ToolbarActions
                    groups={actions}
                    moreLabel={text.mediaMoreActions}
                    inline={INLINE_ACTIONS}
                    collapses
                />
                {onUpload && (
                    <Button
                        ref={uploadRef}
                        color="inherit"
                        startIcon={<Icon name="upload" fontSize="small" />}
                        className={styles.upload}
                        onClick={onUpload}
                    >
                        {text.upload}
                    </Button>
                )}
            </div>
        </header>
    );
};

export default MediaHeader;
