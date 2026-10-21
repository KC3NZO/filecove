import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, Ref } from "react";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useTreeSelection } from "../../../hooks/use-tree-selection";
import { useTypeAhead } from "../../../hooks/use-type-ahead";
import { HEADER_HEIGHT, SIDEBAR_WIDTH, rootWide } from "../../../styles/layout";
import { focusOutline } from "../../../styles/mixins";
import { focusTreeItem, isRtl, isTypingKey, matchName, shownTreeItems } from "../../../utils/keyboard";
import Icon from "../../icons/icon";
import SectionItem, { SectionTree } from "./location-item";

import type { OpenMenu, Place, RunShortcut, Section, SectionGroup } from "../../../types";

interface SidebarProps {
    ref?: Ref<HTMLDivElement>;
    title: string;
    groups: SectionGroup[];
    /** The file manager's only section, whose folders then fill the sidebar in place of `groups`. */
    single?: Section;
    expanded: ReadonlySet<string>;
    /** `folderKey` of the open folder. */
    openKey: string | null;
    /** Whether the overlay is showing while the sidebar is collapsed; has no effect once it docks. */
    open: boolean;
    onToggle: (key: string) => void;
    /** Expands a collapsed folder or section that a drag rests on. */
    onExpand: (key: string) => void;
    onNavigate: (place: Place) => void;
    onOpenMenu: OpenMenu;
    onShortcut: RunShortcut;
    onClose: () => void;
}

const sidebarSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    bgcolor: "background.default",

    // Collapsed: an overlay drawer that slides in over the content. It stays inside the
    // file manager rather than portalling to <body>, so an embedded instance overlays only itself.
    position: "absolute",
    zIndex: 2,
    top: 0,
    bottom: 0,
    left: 0,
    width: `min(${SIDEBAR_WIDTH + 32}px, 85%)`,
    boxShadow: 8,
    transform: "translateX(-100%)",
    // Hidden, not just off-screen, so its buttons drop out of the tab order while closed.
    visibility: "hidden",
    transition: theme.transitions.create(["transform", "visibility"], {
        duration: theme.transitions.duration.enteringScreen,
        easing: theme.transitions.easing.easeOut,
    }),
    '&[data-open="true"]': {
        transform: "none",
        visibility: "visible",
    },

    // Docked beside the content.
    [rootWide]: {
        position: "relative",
        zIndex: "auto",
        width: SIDEBAR_WIDTH,
        boxShadow: "none",
        transform: "none",
        visibility: "visible",
        transition: "none",
    },
});

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    flexShrink: 0,
    minHeight: HEADER_HEIGHT,
    px: 1,
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const navSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    px: 1,
    pb: 1,
};

const groupTitleSx: SxProps<Theme> = {
    display: "block",
    px: 1.5,
    pt: 0.5,
    pb: 0.5,
    color: "text.secondary",
    fontWeight: 600,
};

// Only shows a ring while it has nothing to hand the focus to, such as a single section still loading.
const treeSx: SxProps<Theme> = {
    borderRadius: 2,
    outline: "none",
    "&:focus-visible": focusOutline,
};

const listSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    m: 0,
    p: 0,
};

const rootListSx: SxProps<Theme> = {
    m: 0,
    p: 0,
};

const dividerSx: SxProps<Theme> = {
    mx: 1.25,
    my: 1,
};

/**
 * The sidebar: the file manager's title and a tree of its sections and their folders, or of a
 * single section's folders.
 *
 * The tree is one stop in the tab order. Tabbed to, it hands the focus to the row that had it
 * last, or else the open folder's, or the first; while a row has it, the tree steps out of the
 * tab order so Shift+Tab leaves it. Up, Down, Home and End move between the rows shown, Right
 * goes into an expanded row and Left out to the row above, and typing finds a row by its name.
 * The rows take the keys that act on them (`TreeItem` in `location-item.tsx`).
 *
 * As an overlay, it takes the focus as it opens, closes on Escape, and closes when the focus
 * moves on to the file manager behind it.
 */
const Sidebar = ({
    ref,
    title,
    groups,
    single,
    expanded,
    openKey,
    open,
    onToggle,
    onExpand,
    onNavigate,
    onOpenMenu,
    onShortcut,
    onClose,
}: SidebarProps) => {
    // The sidebar's own selection; the content's lives in its folder view, and neither sees the other.
    const { selection, select, selectSection, reset } = useTreeSelection(openKey);
    const typeAhead = useTypeAhead();
    const treeRef = useRef<HTMLDivElement>(null);
    // `folderKey` of the row that had the focus last, which gets it back when the tree is tabbed to.
    const lastFocused = useRef<string | null>(null);
    const [focusInside, setFocusInside] = useState(false);

    // The overlay takes the focus as it slides in.
    useEffect(() => {
        if (open) {
            treeRef.current?.focus();
        }
    }, [open]);

    // Picking a location closes the overlay; expanding or selecting a folder doesn't, so the tree can be browsed in it.
    const handleNavigate = useCallback(
        (place: Place) => {
            reset();
            onNavigate(place);
            onClose();
        },
        [reset, onNavigate, onClose],
    );

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            onClose();
        }
    };

    // Tabbing out of the overlay onto the file manager behind it closes the overlay, as a click
    // there does. The focus going to a menu or a dialog, which portal out of the file manager, keeps it.
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const to = event.relatedTarget;

        if (
            open &&
            to instanceof Node &&
            !event.currentTarget.contains(to) &&
            event.currentTarget.parentElement?.contains(to)
        ) {
            onClose();
        }
    };

    const handleTreeFocus = (event: FocusEvent<HTMLDivElement>) => {
        const tree = event.currentTarget;

        if (event.target !== tree) {
            const key = event.target instanceof HTMLElement ? event.target.dataset.treeKey : undefined;

            if (key !== undefined) {
                lastFocused.current = key;
            }

            setFocusInside(true);

            return;
        }

        const rows = shownTreeItems(tree);
        const row =
            rows.find((item) => item.dataset.treeKey === lastFocused.current) ??
            rows.find((item) => item.getAttribute("aria-current") === "page") ??
            rows[0];

        if (row) {
            focusTreeItem(row);
        }
    };

    const handleTreeBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            setFocusInside(false);
        }
    };

    // Moving between rows; the rows take the keys that act on them first.
    const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.defaultPrevented || event.altKey) {
            return;
        }

        const tree = event.currentTarget;
        const item =
            event.target instanceof HTMLElement && event.target.getAttribute("role") === "treeitem" ? event.target : null;
        const rows = shownTreeItems(tree);
        const index = item ? rows.indexOf(item) : -1;
        const rtl = isRtl(tree);
        let next: HTMLElement | null | undefined;

        switch (event.key) {
            case "ArrowDown":
                next = rows[index + 1];
                break;
            case "ArrowUp":
                next = index < 0 ? rows[0] : rows[index - 1];
                break;
            case "Home":
                next = rows[0];
                break;
            case "End":
                next = rows.at(-1);
                break;
            // Into an expanded row, to its first folder, and out of a collapsed one, to the row above.
            case rtl ? "ArrowLeft" : "ArrowRight":
                next =
                    item?.getAttribute("aria-expanded") === "true"
                        ? item.querySelector<HTMLElement>('[role="treeitem"]')
                        : null;
                break;
            case rtl ? "ArrowRight" : "ArrowLeft":
                next = item?.parentElement?.closest<HTMLElement>('[role="treeitem"]');
                break;
            default:
                if (isTypingKey(event)) {
                    const names = rows.map((row) => row.getAttribute("aria-label") ?? "");
                    const match = matchName(names, Math.max(index, 0), typeAhead.type(event.key));

                    next = rows[match];
                    event.preventDefault();
                }
        }

        if (next && tree.contains(next)) {
            event.preventDefault();
            focusTreeItem(next);
        }
    };

    // A single section that hides its folders still gets its row, so the sidebar isn't left empty.
    const tree = single && single.showFolders !== false ? single : null;

    return (
        <Box ref={ref} sx={sidebarSx} data-open={open} onKeyDown={handleKeyDown} onBlur={handleBlur}>
            <Box sx={headerSx}>
                <IconButton aria-label="Search">
                    <Icon name="search" fontSize="small" />
                </IconButton>
                <Typography component="span" noWrap sx={titleSx}>
                    {title}
                </Typography>
                <IconButton aria-label="Main menu">
                    <Icon name="menu" fontSize="small" />
                </IconButton>
            </Box>
            <Box component="nav" aria-label="Sidebar" sx={navSx}>
                <Box
                    ref={treeRef}
                    role="tree"
                    aria-label={tree ? tree.label : "Sections"}
                    aria-multiselectable
                    tabIndex={focusInside ? -1 : 0}
                    sx={treeSx}
                    onFocus={handleTreeFocus}
                    onBlur={handleTreeBlur}
                    onKeyDown={handleTreeKeyDown}
                >
                    {tree && (
                        <Box component="ul" role="none" sx={rootListSx}>
                            <SectionTree
                                section={tree}
                                expanded={expanded}
                                openKey={openKey}
                                selection={selection}
                                onToggle={onToggle}
                                onExpand={onExpand}
                                onNavigate={handleNavigate}
                                onSelectFolder={select}
                                onSelectSection={selectSection}
                                onOpenMenu={onOpenMenu}
                                onShortcut={onShortcut}
                            />
                        </Box>
                    )}
                    {/* Each group is a `group` of the tree, named by its title, which is hidden from screen
                        readers so it isn't read twice. */}
                    {!tree && groups.map((group, index) => (
                        <Fragment key={group.id}>
                            {index > 0 && <Divider sx={dividerSx} aria-hidden />}
                            {group.title && (
                                <Typography variant="caption" sx={groupTitleSx} aria-hidden>
                                    {group.title}
                                </Typography>
                            )}
                            <Box component="ul" role="group" aria-label={group.title} sx={listSx}>
                                {group.sections.map((section) => (
                                    <SectionItem
                                        key={section.id}
                                        section={section}
                                        expanded={expanded}
                                        openKey={openKey}
                                        selection={selection}
                                        onToggle={onToggle}
                                        onExpand={onExpand}
                                        onNavigate={handleNavigate}
                                        onSelectFolder={select}
                                        onSelectSection={selectSection}
                                        onOpenMenu={onOpenMenu}
                                        onShortcut={onShortcut}
                                    />
                                ))}
                            </Box>
                        </Fragment>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default Sidebar;
