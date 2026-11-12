import { useContext } from "react";
import type { CSSProperties, Ref } from "react";

import { DirectionContext } from "../../contexts/direction-context";
import { useLocale } from "../../hooks/use-locale";
import { fmClasses } from "../../styles/classes";
import theme from "../../styles/theme.module.css";
import { cx } from "../../utils/cx";
import Icon from "../icons/icon";
import Text from "../ui/text";
import ItemIcon from "./content/item-icon";
import styles from "./drag-preview.module.css";

import type { DropEffect, FileEntry } from "../../types";

interface DragPreviewProps {
    ref: Ref<HTMLDivElement>;
    /** The entry the drag started from. */
    entry: FileEntry;
    /** How many entries are dragged, that one included. */
    count: number;
    /**
     * A touch drag's, which follows the finger (`useEntryDrag` places it) and shows what letting
     * go would do, where a mouse drag has the cursor say it.
     */
    touch?: boolean;
    effect?: DropEffect;
}

/** Most cards in the stack, the grabbed entry's included, however many entries are dragged. */
const MAX_LAYERS = 5;

const TOUCH_STYLE: CSSProperties = { left: 0 };

const layerStyle = (layer: number) => ({ "--layer": layer }) as CSSProperties;

/**
 * The drag image: the grabbed entry's icon and name on a card, stacked on a card for each other
 * entry up to `MAX_LAYERS`, with a count of them all when others go along, and for a touch drag a
 * "+" where letting go would copy.
 */
const DragPreview = ({ ref, entry, count, touch = false, effect = "move" }: DragPreviewProps) => {
    const { formatNumber } = useLocale();
    const dir = useContext(DirectionContext);
    // Deepest first, so each card paints over the one below it.
    const depth = Math.min(count, MAX_LAYERS) - 1;
    const layers = Array.from({ length: depth }, (_, index) => depth - index).map((layer) => (
        <div key={layer} className={styles.layer} style={layerStyle(layer)} />
    ));

    return (
        <div
            ref={ref}
            className={cx(theme.theme, touch ? styles.touchRoot : styles.root, fmClasses.dragPreview)}
            style={touch ? TOUCH_STYLE : undefined}
            dir={dir}
            data-effect={touch ? effect : undefined}
            aria-hidden
        >
            <div className={styles.stack}>
                {layers}
                <div className={styles.pill}>
                    <ItemIcon entry={entry} size={1.25} />
                    <Text variant="body2" noWrap className={styles.name}>
                        <bdi>{entry.name}</bdi>
                    </Text>
                    {count > 1 && <div className={styles.count}>{formatNumber(count)}</div>}
                    {touch && effect === "copy" && (
                        <span className={styles.copy}>
                            <Icon name="add" />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DragPreview;
