import LinearProgress from "../ui/linear-progress";
import Text from "../ui/text";
import util from "../../styles/util.module.css";
import styles from "./asset-hold.module.css";

import type { AssetHold } from "../../types";

/**
 * Where a bar is drawn: along a tile's picture's foot, under a row's name, or along the foot of the
 * asset view's notice; the frame and the notice are positioned.
 */
type BarPlace = "frame" | "row" | "view";

const BARS: Record<BarPlace, string> = { frame: styles.barFrame, row: styles.barRow, view: styles.barView };

interface HoldLineProps {
    hold: AssetHold;
    id?: string;
}

interface HoldBarProps {
    hold: AssetHold;
    place: BarPlace;
}

/**
 * Why an asset can't be chosen now, in one line: what its backend is doing and how far along, that
 * it failed, with why for screen readers and as its tooltip, or why its library refuses it.
 */
export const HoldLine = ({ hold, id }: HoldLineProps) => (
    <Text id={id} variant="caption" noWrap data-status={hold.status} title={hold.detail} className={styles.line}>
        <bdi>{hold.text}</bdi>
        {hold.detail && (
            <span className={util.visuallyHidden}>
                {` ${hold.detail}`}
            </span>
        )}
    </Text>
);

/**
 * How far along an asset's processing is, filling as its backend says, or moving while it doesn't
 * say; drawn only, as its line says it. Nothing while it isn't being processed.
 */
export const HoldBar = ({ hold, place }: HoldBarProps) =>
    hold.status === "processing" ? (
        <LinearProgress
            aria-hidden
            variant={hold.progress === undefined ? "indeterminate" : "determinate"}
            value={(hold.progress ?? 0) * 100}
            className={BARS[place]}
        />
    ) : null;

/**
 * Why an asset the app drew entirely itself can't be chosen now, under what it drew, with its bar, or
 * the same room empty while it can be, so every asset of the grid is laid out as tall.
 */
export const HoldSlot = ({ hold }: { hold: AssetHold | undefined }) => (
    <div data-part="hold" data-standing={!!hold} className={styles.slot}>
        {hold ? (
            <HoldLine hold={hold} />
        ) : (
            <Text variant="caption" aria-hidden className={styles.line}>
                {"\u00a0"}
            </Text>
        )}
        {hold?.status === "processing" ? <HoldBar hold={hold} place="row" /> : <div className={styles.barRoom} />}
    </div>
);
