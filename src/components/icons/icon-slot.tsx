import Icon from "./icon";
import styles from "./icon.module.css";

import type { IconSource } from "../../types";

interface IconSlotProps {
    icon: IconSource;
}

// Consumer-supplied elements are fitted to the same 1.25rem box as the built-in icons.
const IconSlot = ({ icon }: IconSlotProps) => (
    <span className={styles.slot}>{typeof icon === "string" ? <Icon name={icon} /> : icon}</span>
);

export default IconSlot;
