import type { ComponentType } from "react";

import { useLocale } from "../../../hooks/use-locale";
import Icon from "../../icons/icon";
import Text from "../../ui/text";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import styles from "./no-sections.module.css";

interface NoSectionsProps {
    /** The app's own, drawn in the state's box in place of the file manager's (`slots.noSections`). */
    slot?: ComponentType;
}

/**
 * The content while the file manager has no section to show, as while an app is still getting its
 * sections, in place of an empty panel.
 */
const NoSections = ({ slot: Slot }: NoSectionsProps) => {
    const { text } = useLocale();

    return (
        <div className={cx(styles.state, fmClasses.state)}>
            {Slot ? (
                <Slot />
            ) : (
                <>
                    <Icon name="folder" className={styles.stateIcon} />
                    <Text className={styles.stateTitle}>{text.noSections}</Text>
                </>
            )}
        </div>
    );
};

export default NoSections;
