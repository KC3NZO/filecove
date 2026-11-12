import { memo } from "react";
import type { CSSProperties } from "react";

import { useLocale } from "../../../hooks/use-locale";
import { fmClasses } from "../../../styles/classes";
import marks from "../../../styles/entry.module.css";
import util from "../../../styles/util.module.css";
import { joinIsolated } from "../../../utils/bidi";
import { cx } from "../../../utils/cx";
import { drawnState } from "../../../utils/permissions";
import { belowElement, pointerPosition } from "../../../utils/menu-position";
import { selectModifiers } from "../../../utils/selection";
import { chain, slotAttributesFor } from "../../../utils/slots";
import { SORT_LABELS, toggleSortKey } from "../../../utils/sort";
import { listIconSize } from "../../../utils/zoom";
import Icon from "../../icons/icon";
import ButtonBase from "../../ui/button-base";
import IconButton from "../../ui/icon-button";
import Text from "../../ui/text";
import { DrawnName } from "../find-layer";
import styles from "./file-list.module.css";
import ItemIcon from "./item-icon";

import type { EntryOrigin, FileEntry, FileViewProps, MovingKind, SortKey, SortOrder } from "../../../types";

interface ColumnHeaderProps {
    sortKey: SortKey;
    sort: SortOrder;
    /** The column's label, in place of the key's own. */
    label?: string;
    className?: string;
    onSortChange: (sort: SortOrder) => void;
}

interface FileRowProps
    extends Pick<
        FileViewProps,
        "adapter" | "draggable" | "hasActions" | "onSelect" | "onOpen" | "onMenu" | "entrySlot"
    > {
    entry: FileEntry;
    /**
     * Where a search everywhere's result comes from, or where an entry in the trash was, which the
     * row shows in its Location column.
     */
    origin?: EntryOrigin;
    /** Where the entry is listed, from 0. */
    index: number;
    /** How many entries the folder lists. */
    count: number;
    /** The side of the icon or thumbnail beside the name, in rem, as the zoom has it. */
    iconSize: number;
    /** How far down the listbox the row sits, in px, as the lines place it. */
    top: number;
    /** Whether the row has the view's Tab stop. */
    focused: boolean;
    selected: boolean;
    cut: boolean;
    /**
     * What holds it, a move under way or the trash's work, itself or with a folder it's in; missing
     * while nothing does.
     */
    moving: MovingKind | undefined;
    /** Whether the entry was just uploaded, and is highlighted for a moment. */
    arrived: boolean;
    /** Whether the browser's find in page just came to it, and it's highlighted for a moment. */
    found: boolean;
    dragged: boolean;
    /** Whether the dragged entries would be dropped into this folder now. */
    dropTarget: boolean;
}

/**
 * A sortable column label: picks its key, or reverses the order when it already sorts by it. The
 * column sorting the list tells screen readers its direction, which the arrow only shows.
 */
const ColumnHeader = ({ sortKey, sort, label, className, onSortChange }: ColumnHeaderProps) => {
    const { text } = useLocale();
    const labels = SORT_LABELS[sortKey](text);
    const active = sortKey === sort.key;

    return (
        <div className={cx(className, fmClasses.listCell)} data-column={sortKey}>
            <ButtonBase
                className={styles.columnButton}
                data-active={active}
                onClick={(event) => {
                    // The surface behind the list would take the click as one on empty space and clear the selection.
                    event.stopPropagation();
                    onSortChange(toggleSortKey(sort, sortKey));
                }}
            >
                {label ?? labels.label}
                {active && (
                    <span className={util.visuallyHidden}>
                        {text.sortedColumn(labels[sort.direction])}
                    </span>
                )}
                {active && <Icon name={sort.direction === "asc" ? "arrowUp" : "arrowDown"} className={styles.sortIcon} />}
            </ButtonBase>
        </div>
    );
};

/**
 * One entry's row. Memoized, so scrolling only renders the rows coming into view.
 */
const FileRow = memo(
    ({
        entry,
        origin,
        index,
        count,
        iconSize,
        top,
        focused,
        selected,
        cut,
        moving,
        arrived,
        found,
        adapter,
        draggable,
        dragged,
        dropTarget,
        hasActions,
        onSelect,
        onOpen,
        onMenu,
        entrySlot,
    }: FileRowProps) => {
        const { text, describeListDate, describeSize, describeType } = useLocale();
        // The app's, under what the row sets itself, which goes on as it is.
        const attributes = slotAttributesFor(entrySlot, () => ({
            entry: origin?.entry ?? entry,
            view: "list" as const,
            selected,
        }));

        return (
            <div
                {...attributes}
                className={cx(
                    fmClasses.listRow,
                    styles.row,
                    marks.cut,
                    marks.moving,
                    marks.arrived,
                    marks.focusRing,
                    marks.drag,
                    marks.forcedSelected,
                    attributes?.className,
                )}
                style={{ ...attributes?.style, top }}
                role="option"
                aria-selected={selected}
                // Only some rows are rendered, so each says where it is among all of them.
                aria-setsize={count}
                aria-posinset={index + 1}
                // Its lock and its fading while it's moved are only drawn.
                aria-description={drawnState(text, origin?.entry ?? entry, moving)}
                tabIndex={focused ? 0 : -1}
                // The whole row is the entry's: it's dragged by any part, and a marquee only starts from
                // the empty space around the rows.
                draggable={draggable}
                data-entry-id={entry.id}
                data-no-marquee
                data-striped={index % 2 === 0}
                data-selected={selected}
                data-cut={cut}
                data-moving={!!moving}
                data-arrived={arrived}
                data-found={found}
                data-dragged={dragged}
                data-drop-target={dropTarget}
                onClick={chain(attributes?.onClick, (event) => {
                    event.stopPropagation();
                    onSelect(entry.id, selectModifiers(event));
                })}
                onDoubleClick={chain(attributes?.onDoubleClick, () => onOpen(entry))}
                onContextMenu={chain(attributes?.onContextMenu, (event) => {
                    event.stopPropagation();

                    if (onMenu(pointerPosition(event), entry)) {
                        event.preventDefault();
                    }
                })}
            >
                <div className={cx(styles.nameCell, fmClasses.listCell)} data-column="name">
                    <ItemIcon
                        entry={origin?.entry ?? entry}
                        size={iconSize}
                        adapter={origin?.adapter ?? adapter}
                        view="list"
                    />
                    <div className={styles.nameText}>
                        <Text variant="body2" noWrap className={fmClasses.entryName}>
                            <DrawnName name={entry.name} />
                        </Text>
                        {/* A result says where it is here, rather than its size and date. */}
                        <Text variant="caption" noWrap className={styles.secondaryLine}>
                            {origin?.location ?? joinIsolated([describeSize(entry), describeListDate(entry)])}
                        </Text>
                    </div>
                </div>
                {origin && (
                    <Text variant="body2" color="secondary" noWrap className={cx(styles.locationCell, fmClasses.listCell)} data-column="location">
                        {origin.location}
                    </Text>
                )}
                {/*
                  * The size and the date run as their own letters do, so "3 items" and "10/2/26,
                  * 1:27 PM" aren't turned round on a right-to-left page, while the cells still
                  * line up as the page runs.
                  */}
                <Text variant="body2" color="secondary" noWrap className={cx(styles.sizeCell, fmClasses.listCell)} data-column="size">
                    <bdi>{describeSize(entry)}</bdi>
                </Text>
                <Text variant="body2" color="secondary" noWrap className={cx(styles.typeCell, fmClasses.listCell)} data-column="type">
                    {describeType(entry)}
                </Text>
                <Text variant="body2" color="secondary" noWrap className={cx(styles.modifiedCell, fmClasses.listCell)} data-column="modified">
                    <bdi>{describeListDate(entry)}</bdi>
                </Text>
                <div className={styles.menuCell}>
                    {hasActions && (
                        <IconButton
                            size="small"
                            tabIndex={-1}
                            aria-hidden
                            data-menu-button
                            className={styles.menuButton}
                            // Like a right-click: the menu decides whether it acts on the whole selection.
                            onClick={(event) => {
                                event.stopPropagation();
                                onMenu(belowElement(event.currentTarget), entry);
                            }}
                            onDoubleClick={(event) => event.stopPropagation()}
                        >
                            <Icon name="more" fontSize="small" />
                        </IconButton>
                    )}
                </div>
            </div>
        );
    },
);

/**
 * The entries as rows, a listbox with one option per entry, of which only those in or near view
 * are rendered (`lines`), one to a line. Only the focused row is in the tab order; the folder view
 * moves the focus between rows with the arrow keys. The menu buttons are for pointers alone, since
 * the Menu key or Shift+F10 opens the same menu from the focused row.
 */
const FileList = ({
    entries,
    origins,
    trash,
    lines,
    zoom,
    label,
    focusId,
    selectedIds,
    cutIds,
    movingIds,
    arrivedIds,
    foundId,
    adapter,
    draggable,
    draggedIds,
    dropTargetId,
    hasActions,
    sort,
    onSelect,
    onOpen,
    onMenu,
    onSortChange,
    entrySlot,
}: FileViewProps) => {
    const { text } = useLocale();
    const iconSize = listIconSize(zoom);

    return (
        <div className={cx(styles.list, fmClasses.list)} style={{ "--icon-size": `${iconSize}rem` } as CSSProperties} data-located={!!origins}>
            <div className={cx(styles.headerRow, fmClasses.listHeader)} role="group" aria-label={text.sortBy}>
                <ColumnHeader sortKey="name" sort={sort} className={styles.nameHeader} onSortChange={onSortChange} />
                {origins && (
                    <ColumnHeader
                        sortKey="location"
                        sort={sort}
                        label={trash ? text.trashLocation : undefined}
                        onSortChange={onSortChange}
                    />
                )}
                <ColumnHeader sortKey="size" sort={sort} onSortChange={onSortChange} />
                <ColumnHeader sortKey="type" sort={sort} className={styles.typeCell} onSortChange={onSortChange} />
                <ColumnHeader
                    sortKey="modified"
                    sort={sort}
                    label={trash ? text.sortTrashed : undefined}
                    className={styles.modifiedHeader}
                    onSortChange={onSortChange}
                />
                <div />
            </div>
            <div
                ref={lines.ref}
                className={styles.rows}
                style={{ height: lines.height }}
                role="listbox"
                aria-label={label}
                aria-multiselectable
            >
                {lines.indexes.map((index) => {
                    const entry = entries[index];

                    return (
                        <FileRow
                            key={entry.id}
                            entry={entry}
                            origin={origins?.[index]}
                            index={index}
                            count={entries.length}
                            iconSize={iconSize}
                            top={index * lines.pitch - lines.offset}
                            focused={entry.id === focusId}
                            selected={selectedIds.has(entry.id)}
                            cut={cutIds.has(entry.id)}
                            moving={movingIds.get(entry.id)}
                            arrived={!!arrivedIds?.has(entry.id)}
                            found={entry.id === foundId}
                            adapter={adapter}
                            draggable={draggable}
                            dragged={draggedIds.has(entry.id)}
                            dropTarget={dropTargetId === entry.id}
                            hasActions={hasActions}
                            onSelect={onSelect}
                            onOpen={onOpen}
                            onMenu={onMenu}
                            entrySlot={entrySlot}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default FileList;
