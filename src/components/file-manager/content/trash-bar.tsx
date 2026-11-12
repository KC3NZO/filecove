import { useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import Icon from "../../icons/icon";
import Button from "../../ui/button";
import Text from "../../ui/text";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import styles from "./trash-bar.module.css";

import type { Section } from "../../../types";

interface TrashBarProps {
    /** The trash, whose root is open. */
    section: Section;
    /** Asks to confirm emptying the trash; missing when its adapter can't delete. */
    onEmpty?: () => void;
}

/**
 * Says what the trash is for, with its own button emptying it, disabled while its listing is empty,
 * hidden entries counting, as they go with it.
 */
const TrashBar = ({ section, onEmpty }: TrashBarProps) => {
    const { text } = useLocale();
    // The open folder's view lists it; the bar only reads it.
    const { state } = useFolder(section, section.rootId, false);
    const empty = state?.status === "ready" && !state.partial && state.entries?.length === 0;

    return (
        <div className={cx(styles.bar, fmClasses.trashBar)}>
            <Icon name="delete" fontSize="small" className={styles.icon} />
            <Text variant="body2" className={styles.hint}>
                {text.trashHint}
            </Text>
            {onEmpty && (
                <Button size="small" color="error" disabled={empty} className={styles.button} onClick={onEmpty}>
                    {text.trashEmptyButton}
                </Button>
            )}
        </div>
    );
};

export default TrashBar;
