import { useId } from "react";
import type { Ref } from "react";

import { useLocale } from "../../hooks/use-locale";
import Icon from "../icons/icon";
import Button from "../ui/button";
import Text from "../ui/text";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./choose-bar.module.css";

interface ChooseBarProps {
    /** How many are selected, in every library. */
    count: number;
    /** How many are selected, in words, for its button; "Selected" with none and no limit to say. */
    selectedText: string | undefined;
    /** That as many as may be are selected, said beside Choose while nothing holds it back. */
    note: string | undefined;
    /** What holds Choose back, said beside it, while picks can't be chosen; nothing otherwise. */
    held: string | undefined;
    /** Whether the selected column is open over the library. */
    chosenOpen: boolean;
    /** Whether there's a column to open: not one at a time with nothing selected. */
    showOpener: boolean;
    /** The button opening the selected column, which takes the focus back as it closes. */
    openerRef: Ref<HTMLButtonElement>;
    onOpenChosen: () => void;
    /** Choose, while finishing is the app's to take; without it, the app takes the picks as they change. */
    onChoose: (() => void) | undefined;
}

/**
 * Under the library, where there's no room to dock the selected column: a button opening it over
 * the library, with how many are selected, and Choose.
 */
const ChooseBar = ({
    count,
    selectedText,
    note,
    held,
    chosenOpen,
    showOpener,
    openerRef,
    onOpenChosen,
    onChoose,
}: ChooseBarProps) => {
    const { text } = useLocale();
    const heldId = useId();
    const said = held ?? note;

    if (!onChoose && !showOpener) {
        return null;
    }

    return (
        <div className={cx(styles.bar, fmClasses.mediaChooseBar)}>
            {showOpener ? (
                <Button
                    ref={openerRef}
                    color="inherit"
                    aria-expanded={chosenOpen}
                    endIcon={<Icon name="expand" fontSize="small" />}
                    className={styles.open}
                    onClick={onOpenChosen}
                >
                    {selectedText ?? text.mediaChosen}
                </Button>
            ) : (
                <div className={styles.open} />
            )}
            {said && (
                <Text id={heldId} variant="body2" noWrap title={said} className={styles.held}>
                    {said}
                </Text>
            )}
            {onChoose && (
                <Button
                    variant="contained"
                    disableElevation
                    disabled={count === 0 || !!held}
                    aria-describedby={held ? heldId : undefined}
                    onClick={onChoose}
                >
                    {text.mediaChoose}
                </Button>
            )}
        </div>
    );
};

export default ChooseBar;
