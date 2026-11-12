import { memo } from "react";
import type { CSSProperties } from "react";

import { useLocale } from "../../../hooks/use-locale";
import { fmClasses } from "../../../styles/classes";
import marks from "../../../styles/entry.module.css";
import { cx } from "../../../utils/cx";
import { pointerPosition } from "../../../utils/menu-position";
import { drawnState } from "../../../utils/permissions";
import { selectModifiers } from "../../../utils/selection";
import { chain, slotAttributesFor } from "../../../utils/slots";
import { gridSize } from "../../../utils/zoom";
import Icon from "../../icons/icon";
import Text from "../../ui/text";
import { DrawnName } from "../find-layer";
import styles from "./file-grid.module.css";
import ItemIcon from "./item-icon";

import type { EntryOrigin, FileEntry, FileViewProps, MovingKind } from "../../../types";

interface FileTileProps
    extends Pick<FileViewProps, "adapter" | "draggable" | "onSelect" | "onOpen" | "onMenu" | "entrySlot"> {
    entry: FileEntry;
    /** Where a search everywhere's result comes from: its own entry and adapter give its icon, and its location is shown under the name. */
    origin?: EntryOrigin;
    /** Where the entry is listed, from 0. */
    index: number;
    /** How many entries the folder lists. */
    count: number;
    /** The side of the icon or thumbnail, in rem, as the zoom has it. */
    iconSize: number;
    /** How far down the listbox the tile's line sits, in px, as the lines place it. */
    top: number;
    /** The grid column the tile goes in, from 0. */
    column: number;
    /** Whether the tile has the view's Tab stop. */
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
 * One entry's tile. Memoized, so scrolling only renders the tiles coming into view.
 */
const FileTile = memo(
    ({
        entry,
        origin,
        index,
        count,
        iconSize,
        top,
        column,
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
        onSelect,
        onOpen,
        onMenu,
        entrySlot,
    }: FileTileProps) => {
        const { text } = useLocale();
        // The app's, under what the tile sets itself, which goes on as it is.
        const attributes = slotAttributesFor(entrySlot, () => ({
            entry: origin?.entry ?? entry,
            view: "grid" as const,
            selected,
        }));

        return (
            <div
                {...attributes}
                className={cx(
                    fmClasses.gridTile,
                    styles.tile,
                    marks.cut,
                    marks.moving,
                    marks.arrived,
                    marks.focusRing,
                    marks.drag,
                    marks.forcedSelected,
                    attributes?.className,
                )}
                // The span ends the tile's box at its column's far side, not at the grid's.
                style={{ ...attributes?.style, top, gridColumn: `${column + 1} / span 1` }}
                role="option"
                aria-selected={selected}
                // Only some tiles are rendered, so each says where it is among all of them.
                aria-setsize={count}
                aria-posinset={index + 1}
                // Its lock and its fading while it's moved are only drawn.
                aria-description={drawnState(text, origin?.entry ?? entry, moving)}
                tabIndex={focused ? 0 : -1}
                draggable={draggable}
                data-entry-id={entry.id}
                data-no-marquee
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
                <ItemIcon
                    entry={origin?.entry ?? entry}
                    size={iconSize}
                    adapter={origin?.adapter ?? adapter}
                    view="grid"
                />
                <Text variant="body2" className={cx(styles.name, fmClasses.entryName)}>
                    <DrawnName name={entry.name} />
                </Text>
                {origin && (
                    <div className={styles.location}>
                        <Icon name="folder" className={styles.locationIcon} />
                        <span className={styles.locationText}>
                            {origin.location}
                        </span>
                    </div>
                )}
            </div>
        );
    },
);

/**
 * The entries as tiles, a listbox with one option per entry, of which only those in or near view
 * are rendered (`lines`), as many to a line as fit. The arrow keys move through them in two
 * directions. Only the focused tile is in the tab order.
 */
const FileGrid = ({
    entries,
    origins,
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
    onSelect,
    onOpen,
    onMenu,
    entrySlot,
}: FileViewProps) => {
    const size = gridSize(zoom);
    const style = {
        height: lines.height,
        "--column": `${size.column}rem`,
        "--wide-column": `${size.wideColumn}rem`,
    } as CSSProperties;

    return (
        <div className={cx(styles.grid, fmClasses.grid)}>
            <div ref={lines.ref} className={styles.tiles} style={style} role="listbox" aria-label={label} aria-multiselectable>
                {lines.indexes.map((index) => {
                    const entry = entries[index];

                    return (
                        <FileTile
                            key={entry.id}
                            entry={entry}
                            origin={origins?.[index]}
                            index={index}
                            count={entries.length}
                            iconSize={size.icon}
                            top={Math.floor(index / lines.columns) * lines.pitch - lines.offset}
                            column={index % lines.columns}
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

export default FileGrid;
