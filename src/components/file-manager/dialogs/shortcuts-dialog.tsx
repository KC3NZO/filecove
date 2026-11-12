import { Fragment, useContext, useId, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";

import { DirectionContext } from "../../../contexts/direction-context";
import { useLocale } from "../../../hooks/use-locale";
import { fmClasses } from "../../../styles/classes";
import util from "../../../styles/util.module.css";
import { comboId, keyLabel, shortcutKeys, showsShortcuts } from "../../../utils/shortcut";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import Dialog, { DialogContent, DialogTitle } from "../../ui/dialog";
import Text from "../../ui/text";
import styles from "./shortcuts-dialog.module.css";

import type { ActionGroup, FileManagerLocaleText, MainMenuGroup } from "../../../types";

interface ShortcutsDialogProps {
    open: boolean;
    actions: ActionGroup[];
    /** The app's actions in the preview's header, whose shortcuts work there, after its own keys. */
    previewActions: ActionGroup[];
    /** The app's actions in the properties panel's header, whose shortcuts work in the panel. */
    propertiesActions: ActionGroup[];
    mainMenu: MainMenuGroup[];
    /** Whether any section's adapter has `search`, without which there's no search everywhere. */
    canSearchEverywhere: boolean;
    /** Whether a search everywhere can cover more than one section, which gives the field its sections menu. */
    choosesSections: boolean;
    /** Whether any section's adapter has `content`, without which nothing is previewed. */
    canPreview: boolean;
    /** Whether any section takes uploads, without which nothing pasted is uploaded. */
    canUpload: boolean;
    /** Whether any section's adapter has `updateProperties`, without which no property is edited. */
    canEditProperties: boolean;
    /** Whether anything the file manager does can be undone, without which there's no Undo and Redo. */
    canUndo: boolean;
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
    /**
     * False for keys that work where the consumer's shortcuts don't run, such as on the edge of
     * the docked sidebar or properties, which stay listed in a section that yields.
     */
    yields?: false;
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
    canEditProperties: boolean;
    canUndo: boolean;
}

// Stands for any of the four arrows.
const ARROWS = "Arrows";

/** The file manager's own keys, as `keyboard.md` lists them, by where they work. */
const ownSections = ({
    text,
    rtl,
    canSearchEverywhere,
    choosesSections,
    canPreview,
    canUpload,
    canEditProperties,
    canUndo,
}: SectionOptions) => {
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
                ...(canUndo
                    ? [
                          { label: text.undo, combos: [["Ctrl", "Z"]] },
                          { label: text.redo, combos: [["Ctrl", "Shift", "Z"], ["Ctrl", "Y"]] },
                      ]
                    : []),
                { label: text.shortcutToggleHidden, combos: [["Ctrl", "H"]] },
                { label: text.shortcutToggleProperties, combos: [["Alt", "Enter"]] },
                { label: text.shortcutResizePanes, combos: [[start], [end]], yields: false },
                // In a field, where the consumer's shortcuts don't run.
                ...(canEditProperties
                    ? [{ label: text.shortcutSaveProperty, combos: [["Enter"], ["Ctrl", "Enter"]], yields: false as const }]
                    : []),
                // In the content only, so the browser's own zoom still works elsewhere.
                { label: text.zoomIn, combos: [["Ctrl", "+"]] },
                { label: text.zoomOut, combos: [["Ctrl", "-"]] },
                { label: text.zoomReset, combos: [["Ctrl", "0"]] },
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
                { label: text.editPath, combos: [["Ctrl", "L"]] },
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
                { label: text.shortcutFirstLastFile, combos: [["Home"], ["End"]] },
                { label: text.zoomIn, combos: [["+"]] },
                { label: text.zoomOut, combos: [["-"]] },
                { label: text.zoomFit, combos: [["0"]] },
                { label: text.shortcutZoomOriginal, combos: [["1"]] },
                { label: text.shortcutPan, combos: [[ARROWS]] },
                { label: text.rotateClockwise, combos: [["R"]] },
                { label: text.rotateCounterclockwise, combos: [["Shift", "R"]] },
                { label: text.fullScreen, combos: [["F"]] },
                { label: text.close, combos: [["Space"], ["Escape"]] },
            ],
        });
    }

    return sections;
};

/**
 * The consumer's actions, wherever they're shown, and main menu items that have a shortcut, each
 * once, in their order.
 */
const consumerRows = (actions: ActionGroup[][], mainMenu: MainMenuGroup[]) => {
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

    actions.forEach((groups) =>
        groups.forEach((group) => group.actions.forEach((action) => add(action.label, action.shortcut))),
    );
    mainMenu.forEach((group) => group.items.forEach((item) => add(item.label, item.shortcut)));

    return rows;
};

const Key = ({ name, text }: { name: string; text: FileManagerLocaleText }) =>
    name === ARROWS ? (
        <kbd className={styles.key}>
            <span aria-hidden dir="ltr">
                ←↑↓→
            </span>
            <span className={util.visuallyHidden}>
                {text.keyArrows}
            </span>
        </kbd>
    ) : (
        <kbd className={styles.key}>
            {keyLabel(name, text)}
        </kbd>
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
    previewActions,
    propertiesActions,
    mainMenu,
    canSearchEverywhere,
    choosesSections,
    canPreview,
    canUpload,
    canEditProperties,
    canUndo,
    onClose,
    onClosed,
}: ShortcutsDialogProps) => {
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    const id = useId();
    const contentRef = useRef<HTMLDivElement>(null);
    const rtl = dir === "rtl";

    const sections = useMemo(() => {
        const own = ownSections({
            text,
            rtl,
            canSearchEverywhere,
            choosesSections,
            canPreview,
            canUpload,
            canEditProperties,
            canUndo,
        });
        // Only the content's and the tree's shortcuts, and the main menu's, come before keys of the
        // file manager's own; the preview's and the panel's work there alone.
        const theirs = consumerRows([actions, previewActions, propertiesActions], mainMenu);
        const taken = new Set(consumerRows([actions], mainMenu).flatMap((row) => row.combos.map(comboId)));
        const shown = own.flatMap((section) => {
            const rows = section.yields
                ? section.rows.flatMap((row) => {
                      if (row.yields === false) {
                          return [row];
                      }

                      const combos = row.combos.filter((combo) => !taken.has(comboId(combo)));

                      return combos.length > 0 || row.hint ? [{ ...row, combos }] : [];
                  })
                : section.rows;

            return rows.length > 0 ? [{ ...section, rows }] : [];
        });

        return theirs.length > 0 ? [...shown, { title: text.shortcutsActions, rows: theirs }] : shown;
    }, [
        text,
        rtl,
        canSearchEverywhere,
        choosesSections,
        canPreview,
        canUpload,
        canEditProperties,
        canUndo,
        actions,
        previewActions,
        propertiesActions,
        mainMenu,
    ]);

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
            className={fmClasses.shortcutsDialog}
            aria-labelledby={`${id}-title`}
            disableRestoreFocus
            onClose={onClose}
            // The list takes the focus once the dialog has faded in, so the arrows and Page Down scroll it.
            onEntered={() => contentRef.current?.focus()}
            onExited={onClosed}
            onKeyDown={handleKeyDown}
        >
            <DialogTitle id={`${id}-title`} className={styles.title}>
                {text.keyboardShortcuts}
            </DialogTitle>
            <TooltipIconButton label={text.close} className={styles.close} onClick={onClose}>
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
            <DialogContent ref={contentRef} tabIndex={0} className={styles.content}>
                <div className={styles.columns}>
                    {sections.map((section, index) => (
                        <section key={section.title} aria-labelledby={`${id}-${index}`} className={styles.section}>
                            <Text id={`${id}-${index}`} component="h3" variant="body2" className={styles.heading}>
                                {section.title}
                            </Text>
                            <dl className={styles.list}>
                                {section.rows.map((row, rowIndex) => (
                                    <div key={`${rowIndex}:${row.label}`} className={styles.row}>
                                        <Text component="dt" variant="body2" className={styles.term}>
                                            <bdi>{row.label}</bdi>
                                        </Text>
                                        {/* Keys run as their names do: left to right for Latin ones, even
                                            on a right-to-left page, as "Ctrl+F" is written there. */}
                                        <dd dir="auto" className={styles.keys}>
                                            {row.hint && (
                                                <Text component="span" variant="body2" color="secondary">
                                                    {row.hint}
                                                </Text>
                                            )}
                                            {row.combos.map((combo, alternative) => (
                                                <Fragment key={comboId(combo)}>
                                                    {alternative > 0 && (
                                                        <span className={styles.join}>
                                                            /
                                                        </span>
                                                    )}
                                                    {combo.map((key, place) => (
                                                        <Fragment key={place}>
                                                            {place > 0 && (
                                                                <span className={styles.join}>
                                                                    +
                                                                </span>
                                                            )}
                                                            <Key name={key} text={text} />
                                                        </Fragment>
                                                    ))}
                                                </Fragment>
                                            ))}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ShortcutsDialog;
