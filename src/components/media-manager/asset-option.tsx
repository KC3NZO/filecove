import { memo, useCallback, useId, useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { AssetLookContext } from "../../contexts/asset-look-context";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { ROW_PICTURE, TILE_LAYOUTS } from "../../styles/media-layout";
import Icon from "../icons/icon";
import { HoldSlot } from "./asset-hold";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./asset-option.module.css";
import AssetTrail, { TrailRoom } from "./asset-trail";
import GroupCheck from "./group-check";
import MediaRow from "./media-row";
import MediaTile from "./media-tile";
import OpenButton from "./open-button";

import type { AssetHold, FileAdapter, FileEntry, FolderRef, MediaAssetDraw, MediaKind, MediaLayout } from "../../types";

interface AssetOptionProps {
    entry: FileEntry;
    kind: MediaKind;
    /** What it's shown as: a tile of the kind's shape, or a row. */
    layout: MediaLayout;
    adapter: FileAdapter;
    /** Where the entry is shown, from 0. */
    index: number;
    /** How many the grid shows, for screen readers, as only those in or near view are rendered. */
    count: number;
    /** Where its line is, in px from the listbox's top. */
    top: number;
    /** Its column in the line, from 0; always 0 in a list of rows. */
    column: number;
    selected: boolean;
    /** Why it can't be chosen now: it isn't selected then, but is opened. */
    hold: AssetHold | undefined;
    /** The backend's work on it while it can be chosen all the same, shown the same way, unfaded. */
    work: AssetHold | undefined;
    /** Where it is below the level searched, as a search's result from further down. */
    trail: readonly FolderRef[] | undefined;
    /** Whether there's no room for it among those selected (`maxChoices`): dimmed, with nothing said on it. */
    limited: boolean;
    /** Whether it's a group that can be selected, which has a check of its own to do it by. */
    checkable: boolean;
    /** Whether it has the grid's Tab stop. */
    focused: boolean;
    /** What the app draws it with, the library's `renderAsset` or the media manager's. */
    draw: MediaAssetDraw | undefined;
    /** What the app draws it with when it's a group, the library's `renderGroup` or the media manager's. */
    drawGroup: MediaAssetDraw | undefined;
    /** Whether a group has details to open, which puts the Open button on it. */
    opensGroups: boolean;
    /** Whether an asset has a view to open, which puts the Open button on it. */
    opensAssets: boolean;
    onPress: (index: number, event: MouseEvent) => void;
    /** A group's own check. */
    onCheck: (index: number, event: MouseEvent) => void;
    /** A double click, which chooses it, or opens it while nothing is chosen. */
    onActivate: (index: number) => void;
    /** Its button opening it in the library's place. */
    onOpen: (index: number) => void;
    onFocus: (index: number) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

interface AssetBodyProps {
    draw: MediaAssetDraw;
    params: Parameters<MediaAssetDraw>[0];
}

/**
 * What the app's `renderAsset` returns, drawn as a component of its own, so hooks in it belong to
 * this asset. Memoized, so finding out what it drew doesn't draw it again.
 */
const AssetBody = memo(({ draw, params }: AssetBodyProps): ReactNode => draw(params));

/**
 * One asset in the grid, or a group, as a tile or a row: what makes it one to select or to go into,
 * whoever draws it. The `option` with its keys, clicks and marks, the check and the Open button. Inside it,
 * the media manager's own look (`MediaTile`, `MediaRow`), or what the app's `renderAsset` returns.
 * An app may use the same looks there. When it has drawn something else entirely, this says why the
 * asset can't be chosen, and where a search found it, under it, fades it as those do, and names it, what the app drew being read
 * as its description, so no asset is left unnamed or held without a word; the room those take is kept
 * under every asset drawn so while any in the grid needs it, so all are as tall. Absolutely placed at
 * its line and column, as only the assets in or near view are rendered (see `MediaGrid`).
 */
const AssetOption = memo(
    ({
        entry,
        kind,
        layout,
        adapter,
        index,
        count,
        top,
        column,
        selected,
        hold,
        work,
        trail,
        limited,
        checkable,
        focused,
        draw,
        drawGroup,
        opensGroups,
        opensAssets,
        onPress,
        onCheck,
        onActivate,
        onOpen,
        onFocus,
        onKeyDown,
    }: AssetOptionProps) => {
        const row = layout === "list";
        const group = entry.kind === "folder";
        const drawn = group ? drawGroup : draw;
        const thumbnail = useThumbnail(
            entry,
            adapter,
            layout,
            row ? ROW_PICTURE : TILE_LAYOUTS[kind].thumbnail,
            true,
        );
        const standing = hold ?? work;
        const contentId = useId();
        // How many of the media manager's own looks are drawn in what the app returned, told before
        // anything is painted.
        const [looks, setLooks] = useState(0);
        const claim = useCallback(() => {
            setLooks((count) => count + 1);

            return () => setLooks((count) => count - 1);
        }, []);
        // Whether the app has drawn this entirely itself.
        const own = !!drawn && looks === 0;
        const params = useMemo(
            () => ({ asset: entry, kind, layout, adapter, thumbnail, selected, hold: standing, trail }),
            [entry, kind, layout, adapter, thumbnail, selected, standing, trail],
        );
        const Look = row ? MediaRow : MediaTile;

        return (
            <div
                role="option"
                // A group that can't be selected says so by having none of this.
                aria-selected={group && !checkable ? undefined : selected}
                // One selected before it was held, as an upload still processed is, can be taken out. A
                // group is still gone into, so it's never disabled.
                aria-disabled={!group && ((hold && !selected) || limited) ? true : undefined}
                aria-label={own ? entry.name : undefined}
                aria-describedby={own ? contentId : undefined}
                tabIndex={focused ? 0 : -1}
                aria-setsize={count}
                aria-posinset={index + 1}
                data-index={index}
                data-layout={row ? "row" : "tile"}
                data-held={!!hold && !group}
                data-limited={limited}
                className={cx(row ? styles.row : styles.tile, fmClasses.mediaOption)}
                style={{ top, gridColumn: `${column + 1} / span 1` }}
                onClick={(event) => onPress(index, event)}
                onDoubleClick={() => onActivate(index)}
                onFocus={() => onFocus(index)}
                onKeyDown={onKeyDown}
            >
                {drawn ? (
                    <div id={contentId} className={styles.content}>
                        <div data-own={own} className={styles.drawn}>
                            <AssetLookContext value={claim}>
                                <AssetBody draw={drawn} params={params} />
                            </AssetLookContext>
                        </div>
                        {own && <HoldSlot hold={standing} />}
                        {own && (trail && trail.length > 0 ? <AssetTrail trail={trail} /> : <TrailRoom />)}
                    </div>
                ) : (
                    <Look asset={entry} kind={kind} thumbnail={thumbnail} hold={standing} trail={trail} />
                )}
                {(group ? opensGroups : opensAssets) && (
                    <OpenButton
                        name={entry.name}
                        group={group}
                        index={index}
                        onOpen={onOpen}
                        className={row ? styles.rowOpen : styles.tileOpen}
                    />
                )}
                {checkable ? (
                    <GroupCheck index={index} onCheck={onCheck} className={row ? styles.rowGroupCheck : styles.tileGroupCheck} />
                ) : (
                    <span className={row ? styles.rowCheck : styles.tileCheck} aria-hidden>
                        <Icon name="check" />
                    </span>
                )}
            </div>
        );
    },
);

export default AssetOption;
