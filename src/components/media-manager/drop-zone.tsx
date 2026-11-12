import Text from "../ui/text";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./drop-zone.module.css";

interface DropZoneProps {
    /** What a drop does. */
    label: string;
}

/** Over a library while files dragged over it can be dropped there. */
const DropZone = ({ label }: DropZoneProps) => (
    <div className={cx(styles.root, fmClasses.mediaDropZone)}>
        <Text className={styles.label}>{label}</Text>
    </div>
);

export default DropZone;
