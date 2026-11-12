import { useLocale } from "../../hooks/use-locale";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import Button from "../ui/button";
import Text from "../ui/text";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./selection-bar.module.css";

interface SelectionBarProps {
    /** How many entries are selected. */
    count: number;
    /** How many entries the folder has. */
    total: number;
    hasActions: boolean;
    onClose: () => void;
    onSelectAll: () => void;
    onSelectNone: () => void;
    /** Opens the action menu for the selection, below the given button. */
    onMenu: (button: HTMLElement) => void;
}

/** The touch selection mode's bar: leave the mode, the count, select all or none, and the action menu. */
const SelectionBar = ({ count, total, hasActions, onClose, onSelectAll, onSelectNone, onMenu }: SelectionBarProps) => {
    const allSelected = total > 0 && count === total;
    const { text } = useLocale();

    return (
        // Its taps are its own, not clicks on the folder's empty space.
        <div className={cx(styles.bar, fmClasses.selectionBar)} data-no-marquee onClick={(event) => event.stopPropagation()}>
            <TooltipIconButton label={text.doneSelecting} onClick={onClose}>
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
            <Text variant="body2" noWrap className={styles.count}>
                {count === 0 ? text.selectItems : text.selectionCount(count)}
            </Text>
            <Button size="small" onClick={allSelected ? onSelectNone : onSelectAll}>
                {allSelected ? text.selectNone : text.selectAll}
            </Button>
            {hasActions && (
                <TooltipIconButton
                    label={text.selectionActions}
                    disabled={count === 0}
                    onClick={(event) => onMenu(event.currentTarget)}
                >
                    <Icon name="more" fontSize="small" />
                </TooltipIconButton>
            )}
        </div>
    );
};

export default SelectionBar;
