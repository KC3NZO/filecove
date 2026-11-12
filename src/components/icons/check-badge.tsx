import Icon from "./icon";
import styles from "./icon.module.css";

/** The check badge of touch selection mode, drawn only; the item says it's selected itself. */
const CheckBadge = () => (
    <span className={styles.badge} aria-hidden>
        <Icon name="check" />
    </span>
);

export default CheckBadge;
