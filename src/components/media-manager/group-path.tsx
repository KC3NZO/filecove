import { useLocale } from "../../hooks/use-locale";
import Icon from "../icons/icon";
import ButtonBase from "../ui/button-base";
import Text from "../ui/text";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./group-path.module.css";

import type { FileEntry } from "../../types";

interface GroupPathProps {
    /** The library's name, where the path starts. */
    label: string;
    /** The groups gone into from its root, to the one open. */
    trail: readonly FileEntry[];
    /** Goes to the level with that many groups of the trail open. */
    onGoToLevel: (depth: number) => void;
    /** Whether the level it ends at names what's shown as a heading, as it does in the header. */
    heading?: boolean;
}

/**
 * Where the group open is, as it was walked to, as it's only ever listed a level at a time: the
 * library's name and the groups on the way, each going back there, and the one open, which names
 * what's shown: the library itself, with no group open.
 */
const GroupPath = ({ label, trail, onGoToLevel, heading = true }: GroupPathProps) => {
    const { text } = useLocale();
    const before = trail.length > 0 ? [label, ...trail.slice(0, -1).map(({ name }) => name)] : [];

    return (
        <nav aria-label={text.mediaGroupPath} className={cx(styles.path, fmClasses.mediaGroupPath)}>
            <ol className={styles.list}>
                {before.map((name, depth) => (
                    <li key={trail[depth - 1]?.id ?? ""} className={styles.item}>
                        <ButtonBase title={name} className={styles.crumb} onClick={() => onGoToLevel(depth)}>
                            <bdi>{name}</bdi>
                        </ButtonBase>
                        <Icon name="chevronRight" className={styles.separator} aria-hidden />
                    </li>
                ))}
                <li className={styles.item}>
                    <Text component={heading ? "h2" : "span"} noWrap aria-current="page" className={styles.current}>
                        <bdi>{trail.at(-1)?.name ?? label}</bdi>
                    </Text>
                </li>
            </ol>
        </nav>
    );
};

export default GroupPath;
