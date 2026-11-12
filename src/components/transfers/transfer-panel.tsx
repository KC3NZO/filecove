import { useState } from "react";
import type { ReactNode } from "react";

import { useLocale } from "../../hooks/use-locale";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import panel from "../../styles/panel.module.css";
import { isolate, joinIsolated } from "../../utils/bidi";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon, FolderTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import CircularProgress from "../ui/circular-progress";
import Collapse from "../ui/collapse";
import LinearProgress from "../ui/linear-progress";
import Text from "../ui/text";

import type { Locale, TransferItem } from "../../types";

interface TransferPanelProps {
    /** The copies and moves to show, in the order asked for. */
    items: TransferItem[];
    onCancel: (id: number) => void;
    /**
     * Tries a failed copy or move again. Offered on the failed rows that `canRetry` takes, every one
     * of them without it.
     */
    onRetry: (item: TransferItem) => void;
    canRetry?: (item: TransferItem) => boolean;
    /** Cancels every copy and move waiting or under way. */
    onCancelAll: () => void;
    /** Forgets every failed copy and move. */
    onClear: () => void;
}

interface TransferRowProps {
    item: TransferItem;
    onCancel: (id: number) => void;
    /** Tries the failed copy or move again; missing when it can't be. */
    onRetry?: (item: TransferItem) => void;
}

const isActive = (item: TransferItem) => item.status === "queued" || item.status === "running";

/** The entries of a copy or move that haven't gone yet: those a failed one couldn't copy or move. */
const leftOf = ({ entries, went }: TransferItem) =>
    went.length === 0 ? entries : entries.filter((entry) => !went.some((each) => each.entry.id === entry.id));

/**
 * How many entries are being copied and moved, and how many couldn't be, those that went before a
 * failure left out, and how much of what's waiting or under way has been done, measured only once
 * every one of them has reported its total.
 */
const summarize = (items: TransferItem[]) => {
    const active = { copy: 0, move: 0 };
    const failed = { copy: 0, move: 0 };
    let loaded = 0;
    let total = 0;
    let measured = true;

    items.forEach((item) => {
        const count = item.entries.length;

        if (item.status === "failed") {
            failed[item.kind] += count - item.went.length;

            return;
        }

        active[item.kind] += count;
        loaded += item.progress?.loaded ?? 0;
        total += item.progress?.total ?? 0;
        measured &&= item.progress !== undefined;
    });

    const busy = active.copy + active.move > 0;

    return { active, failed, busy, loaded, total, measured: busy && measured && total > 0 };
};

// How far it has got: its bytes once the adapter reports them, or else its entries once it reports
// any of them gone.
const describeRow = ({ kind, entries, target, status, progress, error, went }: TransferItem, locale: Locale) => {
    const { text, formatSize } = locale;
    const folderName = isolate(target.name);

    switch (status) {
        case "queued":
            return (kind === "copy" ? text.transferCopyQueued : text.transferMoveQueued)(folderName);
        case "running": {
            const doing = (kind === "copy" ? text.transferCopying : text.transferMoving)(folderName);

            if (progress) {
                return joinIsolated([
                    doing,
                    text.transferProgress(isolate(formatSize(progress.loaded)), isolate(formatSize(progress.total))),
                ]);
            }

            return went.length > 0
                ? joinIsolated([doing, text.transferItemsDone(went.length, entries.length)])
                : doing;
        }
        case "failed": {
            const why =
                error !== undefined
                    ? isolate(error)
                    : (kind === "copy" ? text.transferCopyFailed : text.transferMoveFailed)(
                          entries.length - went.length,
                      );

            return went.length > 0
                ? joinIsolated([
                      why,
                      (kind === "copy" ? text.transferCopiedSome : text.transferMovedSome)(
                          went.length,
                          entries.length,
                      ),
                  ])
                : why;
        }
    }
};

const TransferRow = ({ item, onCancel, onRetry }: TransferRowProps) => {
    const { id, kind, entries, status, progress, went } = item;
    const locale = useLocale();
    const { text } = locale;
    // A failed one names what's left of it, which Try again goes for.
    const left = status === "failed" ? leftOf(item) : entries;
    const named = left.length > 0 ? left : entries;
    const [only] = named;
    const count = named.length;
    // Without bytes, the bar fills with the entries gone, once the adapter reports any.
    const filled = progress ? progress.loaded / progress.total : went.length > 0 ? went.length / entries.length : null;
    const name = isolate(only.name);

    let icon: ReactNode;

    if (count > 1) {
        icon = <Icon name={kind} fontSize="small" color="action" />;
    } else if (only.kind === "folder") {
        icon = <FolderTypeIcon folderName={only.name} />;
    } else {
        icon = <FileTypeIcon fileName={only.name} />;
    }

    let action: ReactNode = null;

    if (isActive(item)) {
        action = (
            <TooltipIconButton
                size="small"
                label={(kind === "copy" ? text.transferCopyCancel : text.transferMoveCancel)(count, name)}
                onClick={() => onCancel(id)}
            >
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
        );
    } else if (onRetry) {
        action = (
            <TooltipIconButton
                size="small"
                label={(kind === "copy" ? text.transferCopyRetry : text.transferMoveRetry)(count, name)}
                onClick={() => onRetry(item)}
            >
                <Icon name="refresh" fontSize="small" />
            </TooltipIconButton>
        );
    }

    return (
        <li className={cx(panel.row, fmClasses.taskRow)}>
            <div className={panel.slot}>{icon}</div>
            <div className={panel.text}>
                <Text variant="body2" noWrap>
                    {count > 1 ? text.transferItems(count) : <bdi>{only.name}</bdi>}
                </Text>
                {status === "running" && (
                    <LinearProgress
                        variant={filled === null ? "indeterminate" : "determinate"}
                        value={(filled ?? 0) * 100}
                        className={panel.bar}
                    />
                )}
                <Text variant="caption" color={status === "failed" ? "error" : "secondary"} noWrap>
                    {describeRow(item, locale)}
                </Text>
            </div>
            {action}
        </li>
    );
};

/**
 * Copies and moves that have taken a moment, or failed: a summary that can fold the list away, and
 * a row per copy or move with where it goes and how far it has got, to cancel it, or once it has
 * failed, to try it again. One that's done leaves, and the panel goes once none is left. It knows
 * nothing of where it's shown, so it can sit under any view of files. The close button cancels
 * whatever is still under way, and once nothing is, forgets the rest.
 */
const TransferPanel = ({ items, onCancel, onRetry, canRetry, onCancelAll, onClear }: TransferPanelProps) => {
    const [expanded, setExpanded] = useState(true);
    const { text, formatSize } = useLocale();
    const { active, failed, busy, loaded, total, measured } = summarize(items);

    let title: string;
    let status: ReactNode;

    if (busy) {
        title = text.transfersActive(active.copy, active.move);
        status = (
            <CircularProgress
                size={20}
                variant={measured ? "determinate" : "indeterminate"}
                value={measured ? (loaded / total) * 100 : 0}
            />
        );
    } else {
        title = text.transfersFailed(failed.copy, failed.move);
        status = <Icon name="info" color="error" />;
    }

    // What the title leaves out.
    const detail = joinIsolated(
        [
            measured && text.transferProgress(isolate(formatSize(loaded)), isolate(formatSize(total))),
            busy && failed.copy + failed.move > 0 && text.transfersFailedCount(failed.copy + failed.move),
        ].filter((part): part is string => !!part),
    );

    return (
        <section className={cx(panel.panel, fmClasses.taskPanel, fmClasses.transferPanel)} aria-label={text.transfers}>
            <div className={panel.header}>
                <div className={panel.slot}>{status}</div>
                <div className={panel.text}>
                    <Text variant="body2" noWrap className={panel.title} aria-live="polite">
                        {title}
                    </Text>
                    {detail && (
                        <Text variant="caption" color="secondary" noWrap>
                            {detail}
                        </Text>
                    )}
                </div>
                <TooltipIconButton
                    label={expanded ? text.transfersHide : text.transfersShow}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    <Icon name="expand" fontSize="small" className={panel.toggleIcon} />
                </TooltipIconButton>
                <TooltipIconButton
                    label={busy ? text.transfersCancelAll : text.transfersClose}
                    onClick={busy ? onCancelAll : onClear}
                >
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </div>
            <Collapse in={expanded}>
                <ul className={panel.list}>
                    {items.map((item) => (
                        <TransferRow
                            key={item.id}
                            item={item}
                            onCancel={onCancel}
                            onRetry={item.status === "failed" && (!canRetry || canRetry(item)) ? onRetry : undefined}
                        />
                    ))}
                </ul>
            </Collapse>
        </section>
    );
};

export default TransferPanel;
