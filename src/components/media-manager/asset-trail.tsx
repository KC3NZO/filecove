import { useLocale } from "../../hooks/use-locale";
import { joinIsolated } from "../../utils/bidi";
import Text from "../ui/text";
import styles from "./asset-trail.module.css";

import type { FolderRef } from "../../types";

interface AssetTrailProps {
    /** The groups between the level searched and what's found, outermost first. */
    trail: readonly FolderRef[];
}

/** Where a search's result is below the level searched, one line under what else its look says. */
const AssetTrail = ({ trail }: AssetTrailProps) => {
    const { text } = useLocale();
    const place = text.mediaInGroup(
        joinIsolated(
            trail.map(({ name }) => name),
            " / ",
        ),
    );

    return (
        <Text variant="caption" noWrap data-status="trail" title={place} className={styles.trail}>
            {place}
        </Text>
    );
};

export default AssetTrail;

/**
 * The room a trail takes, empty, under what an asset found right in the level searched shows, while
 * the grid shows results from further down too, as every asset in it is laid out as tall.
 */
export const TrailRoom = () => (
    <Text variant="caption" aria-hidden className={styles.room}>
        {"\u00a0"}
    </Text>
);
