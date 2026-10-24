import { Fragment, useContext, useId, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useLocale } from "../../../hooks/use-locale";
import { dialogPaperSx, focusOutline, visuallyHiddenSx } from "../../../styles/mixins";
import { comboId, keyLabel, shortcutKeys, showsShortcuts } from "../../../utils/shortcut";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";

import type { ActionGroup, FileManagerLocaleText, MainMenuGroup } from "../../../types";

interface ShortcutsDialogProps {
    open: boolean;
    actions: ActionGroup[];
    mainMenu: MainMenuGroup[];
    /** Whether any section's adapter has `search`, without which there's no search everywhere. */
    canSearchEverywhere: boolean;
    /** Whether a search everywhere can cover more than one section, which gives the field its sections menu. */
    choosesSections: boolean;
    /** Whether any section's adapter has `content`, without which nothing is previewed. */
    canPreview: boolean;
    /** Whether any section takes uploads, without which nothing pasted is uploaded. */
    canUpload: boolean;
    onClose: () => void;
    /** Called once it has faded out, to give the focus back. */
    onClosed: () => void;
}

/** Keys pressed together, the modifiers first: Ctrl, Shift, F. */
type Combo = readonly string[];

interface ShortcutRow {
    label: string;
    /** Each a combination that does it. */
    combos: Combo[];
    /** Said in place of keys, for what isn't one key, such as typing a name. */
    hint?: string;
}

interface ShortcutSection {
    title: string;
    rows: ShortcutRow[];
    /**
     * Whether the consumer's shortcuts come before these keys, as they do in the content and the
     * tree, so a combination one of them binds does what that does instead and isn't listed here.
     */
    yields?: boolean;
}

interface SectionOptions {
    text: FileManagerLocaleText;
    rtl: boolean;
    canSearchEverywhere: boolean;
    choosesSections: boolean;
    canPreview: boolean;
    canUpload: boolean;
}

// Stands for any of the four arrows.
const ARROWS = "Arrows";

/** The file manager's own keys, as `keyboard.md` lists them, by where they work. */
const ownSections = ({ text, rtl, canSearchEverywhere, choosesSections, canPreview, canUpload }: SectionOptions) => {
    // Back and forward, and expanding and collapsing, swap right to left, as the arrows on the
    // buttons and the chevrons are mirrored.
    const start = rtl ? "ArrowRight" : "ArrowLeft";
    const end = rtl ? "ArrowLeft" : "ArrowRight";
    const sections: ShortcutSection[] = [
        {
            title: text.shortcutsGeneral,
            yields: true,
            rows: [
                { label: text.keyboardShortcuts, combos: [["Ctrl", "?"]] },
                { label: text.shortcutToggleHidden, combos: [["Ctrl", "H"]] },
                { label: text.shortcutContextMenu, combos: [["ContextMenu"], ["Shift", "F10"]] },
                ...(canUpload
                    ? [{ label: text.shortcutPasteFiles, combos: [["Ctrl", "V"], ["Shift", "Insert"]] }]
                    : []),
            ],
        },
        {
            title: text.shortcutsNavigation,
            yields: true,
            rows: [
                { label: text.back, combos: [["Alt", start]] },
                { label: text.forward, combos: [["Alt", end]] },
                { label: text.shortcutGoUp, combos: [["Alt", "ArrowUp"], ["Backspace"]] },
                { label: text.shortcutOpen, combos: [["Enter"], ["Alt", "ArrowDown"]] },
                { label: text.shortcutMove, combos: [[ARROWS]] },
                { label: text.shortcutFirstLast, combos: [["Home"], ["End"]] },
                { label: text.shortcutPage, combos: [["PageUp"], ["PageDown"]] },
                { label: text.shortcutTypeAhead, combos: [], hint: text.shortcutTypeAheadKeys },
            ],
        },
        {
            title: text.shortcutsSelection,
            yields: true,
            rows: [
                { label: text.selectAll, combos: [["Ctrl", "A"]] },
                { label: text.shortcutToggleSelected, combos: [["Space"], ["Ctrl", "Space"]] },
                { label: text.shortcutExtend, combos: [["Shift", ARROWS]] },
                { label: text.shortcutSelectRange, combos: [["Shift", "Space"]] },
                { label: text.shortcutMoveOnly, combos: [["Ctrl", ARROWS]] },
                { label: text.selectNone, combos: [["Escape"]] },
            ],
        },
        {
            title: text.shortcutsSidebar,
            yields: true,
            rows: [
                { label: text.shortcutSwitchPane, combos: [["F6"]] },
                { label: text.shortcutToggleSidebar, combos: [["F9"]] },
                { label: text.shortcutExpand, combos: [[end]] },
                { label: text.shortcutCollapse, combos: [[start]] },
            ],
        },
        {
            title: text.shortcutsSearch,
            rows: [
                { label: text.searchFolder, combos: [["Ctrl", "F"]] },
                ...(canSearchEverywhere ? [{ label: text.searchEverywhere, combos: [["Ctrl", "Shift", "F"]] }] : []),
                { label: text.shortcutSearchResults, combos: [["ArrowDown"], ["Enter"]] },
                ...(choosesSections ? [{ label: text.searchSections, combos: [["Alt", "ArrowDown"]] }] : []),
                { label: text.closeSearch, combos: [["Escape"]] },
            ],
        },
    ];

    if (canPreview) {
        sections.push({
            title: text.shortcutsPreview,
            rows: [
                { label: text.shortcutPreviewStep, combos: [["ArrowLeft"], ["ArrowRight"]] },
                { label: text.zoomIn, combos: [["+"]] },
                { label: text.zoomOut, combos: [["-"]] },
                { label: text.zoomFit, combos: [["0"]] },
                { label: text.shortcutZoomOriginal, combos: [["1"]] },
                { label: text.shortcutPan, combos: [[ARROWS]] },
                { label: text.close, combos: [["Space"], ["Escape"]] },
            ],
        });
    }

    return sections;
};

/** The consumer's actions and main menu items that have a shortcut, each once, in their order. */
const consumerRows = (actions: ActionGroup[], mainMenu: MainMenuGroup[]) => {
    const rows: ShortcutRow[] = [];
    const seen = new Set<string>();
    const add = (label: string, shortcut: string | undefined) => {
        const combo = shortcut && shortcutKeys(shortcut);
        const id = combo && `${label}\n${comboId(combo)}`;

        if (combo && id && !seen.has(id)) {
            seen.add(id);
            rows.push({ label, combos: [combo] });
        }
    };

    actions.forEach((group) => group.actions.forEach((action) => add(action.label, action.shortcut)));
    mainMenu.forEach((group) => group.items.forEach((item) => add(item.label, item.shortcut)));

    return rows;
};

const titleSx: SxProps<Theme> = {
    paddingInlineEnd: 7,
};

const closeSx: SxProps<Theme> = {
    position: "absolute",
    top: 12,
    insetInlineEnd: 12,
};

// The close button sits between the title and the content, so MUI's own rule taking the padding
// off the content's top doesn't reach it.
const contentSx: SxProps<Theme> = {
    pt: 0,
    outline: "none",
    "&:focus-visible": focusOutline,
};

// As many columns as fit, each section kept whole. Inside the scrolling content rather than on it:
// a multi-column box of limited height lays further columns out sideways, past its edge, rather
// than growing down.
const columnsSx: SxProps<Theme> = {
    columnWidth: "20rem",
    columnGap: 3,
};

const sectionSx: SxProps<Theme> = {
    breakInside: "avoid",
    pb: 2.5,
};

const headingSx: SxProps<Theme> = {
    px: 1.5,
    pb: 0.75,
    color: "text.secondary",
    fontWeight: 600,
};

// A view on paper inside the dialog, as the transfer picker's list is.
const listSx: SxProps<Theme> = {
    m: 0,
    borderRadius: 2,
    bgcolor: "background.paper",
    overflow: "hidden",
};

const rowSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    minHeight: 44,
    px: 1.5,
    py: 0.75,
    "& + &": {
        borderTop: 1,
        borderColor: "divider",
    },
};

const termSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
};

const keysSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 0.5,
    flexShrink: 0,
    maxWidth: "55%",
    m: 0,
};

// Holds the arrows' visually hidden name, which would otherwise be placed against the dialog's
// paper and, from far down the list, stretch the paper's own scrolling area.
const keySx: SxProps<Theme> = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "1.75rem",
    height: "1.625rem",
    px: 0.75,
    border: 1,
    borderBottomWidth: 2,
    borderColor: "divider",
    borderRadius: 1,
    bgcolor: "background.default",
    color: "text.primary",
    fontFamily: "inherit",
    fontSize: "0.75rem",
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
};

const joinSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

const Key = ({ name, text }: { name: string; text: FileManagerLocaleText }) =>
    name === ARROWS ? (
        <Box component="kbd" sx={keySx}>
            <span aria-hidden dir="ltr">
                ←↑↓→
            </span>
            <Box component="span" sx={visuallyHiddenSx}>
                {text.keyArrows}
            </Box>
        </Box>
    ) : (
        <Box component="kbd" sx={keySx}>
            {keyLabel(name, text)}
        </Box>
    );

/**
 * The window listing the keys, opened with Ctrl+?, the main menu's "Keyboard shortcuts" or
 * `FileManagerApi.showShortcuts`: the file manager's own, by where they work, and then the
 * consumer's actions and main menu items that have a shortcut. A key one of those binds is left
 * out of the file manager's own where the consumer's come first, so each key is listed once for
 * what it does. Search everywhere and the preview's keys are only listed when an adapter offers them.
 */
const ShortcutsDialog = ({
    open,
    actions,
    mainMenu,
    canSearchEverywhere,
    choosesSections,
    canPreview,
    canUpload,
    onClose,
    onClosed,
}: ShortcutsDialogProps) => {
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    const id = useId();
    const contentRef = useRef<HTMLDivElement>(null);
    const rtl = dir === "rtl";

    const sections = useMemo(() => {
        const own = ownSections({ text, rtl, canSearchEverywhere, choosesSections, canPreview, canUpload });
        const theirs = consumerRows(actions, mainMenu);
        const taken = new Set(theirs.flatMap((row) => row.combos.map(comboId)));
        const shown = own.flatMap((section) => {
            const rows = section.yields
                ? section.rows.flatMap((row) => {
                      const combos = row.combos.filter((combo) => !taken.has(comboId(combo)));

                      return combos.length > 0 || row.hint ? [{ ...row, combos }] : [];
                  })
                : section.rows;

            return rows.length > 0 ? [{ ...section, rows }] : [];
        });

        return theirs.length > 0 ? [...shown, { title: text.shortcutsActions, rows: theirs }] : shown;
    }, [text, rtl, canSearchEverywhere, choosesSections, canPreview, canUpload, actions, mainMenu]);

    // The list takes the focus once the dialog has faded in, so the arrows and Page Down scroll it.
    const slotProps = useMemo(
        () => ({
            paper: { sx: dialogPaperSx },
            transition: {
                onEntered: () => contentRef.current?.focus(),
                onExited: onClosed,
            },
        }),
        [onClosed],
    );

    // Ctrl+? closes it as it opened it.
    const handleKeyDown = (event: KeyboardEvent) => {
        if (showsShortcuts(event)) {
            event.preventDefault();
            onClose();
        }
    };

    return (
        <Dialog
            dir={dir}
            open={open}
            fullWidth
            maxWidth="md"
            aria-labelledby={`${id}-title`}
            disableRestoreFocus
            slotProps={slotProps}
            onClose={onClose}
            onKeyDown={handleKeyDown}
        >
            <DialogTitle id={`${id}-title`} sx={titleSx}>
                {text.keyboardShortcuts}
            </DialogTitle>
            <TooltipIconButton label={text.close} sx={closeSx} onClick={onClose}>
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
            <DialogContent ref={contentRef} tabIndex={0} sx={contentSx}>
                <Box sx={columnsSx}>
                    {sections.map((section, index) => (
                        <Box key={section.title} component="section" aria-labelledby={`${id}-${index}`} sx={sectionSx}>
                            <Typography id={`${id}-${index}`} component="h3" variant="body2" sx={headingSx}>
                                {section.title}
                            </Typography>
                            <Box component="dl" sx={listSx}>
                                {section.rows.map((row, rowIndex) => (
                                    <Box key={`${rowIndex}:${row.label}`} sx={rowSx}>
                                        <Typography component="dt" variant="body2" sx={termSx}>
                                            <bdi>{row.label}</bdi>
                                        </Typography>
                                        {/* Keys run as their names do: left to right for Latin ones, even
                                            on a right-to-left page, as "Ctrl+F" is written there. */}
                                        <Box component="dd" dir="auto" sx={keysSx}>
                                            {row.hint && (
                                                <Typography component="span" variant="body2" color="text.secondary">
                                                    {row.hint}
                                                </Typography>
                                            )}
                                            {row.combos.map((combo, alternative) => (
                                                <Fragment key={comboId(combo)}>
                                                    {alternative > 0 && (
                                                        <Box component="span" sx={joinSx}>
                                                            /
                                                        </Box>
                                                    )}
                                                    {combo.map((key, place) => (
                                                        <Fragment key={place}>
                                                            {place > 0 && (
                                                                <Box component="span" sx={joinSx}>
                                                                    +
                                                                </Box>
                                                            )}
                                                            <Key name={key} text={text} />
                                                        </Fragment>
                                                    ))}
                                                </Fragment>
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ShortcutsDialog;
