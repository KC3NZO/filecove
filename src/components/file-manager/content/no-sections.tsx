import { useLocale } from "../../../hooks/use-locale";
import Icon from "../../icons/icon";
import Text from "../../ui/text";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import styles from "./no-sections.module.css";

/**
 * The content while the file manager has no section to show, as while an app is still getting its
 * sections, in place of an empty panel.
 */
const NoSections = () => {
    const { text } = useLocale();

    return (
        <div className={cx(styles.state, fmClasses.state)}>
            <Icon name="folder" className={styles.stateIcon} />
            <Text className={styles.stateTitle}>{text.noSections}</Text>
        </div>
    );
};

export default NoSections;
