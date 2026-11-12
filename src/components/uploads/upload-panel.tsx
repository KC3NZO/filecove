import { useId, useState } from "react";
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
import styles from "./upload-panel.module.css";

import type {
    FileUploadItem,
    FolderUploadItem,
    Locale,
    UploadFailure,
    UploadItem,
    UploadLocaleText,
} from "../../types";

interface UploadPanelProps {
    items: UploadItem[];
    onCancel: (id: number) => void;
    onRetry: (id: number) => void;
    /**
     * Shows a finished upload in the folder it went into. Offered on the rows of finished uploads
     * that `canShow` takes, every one of them without it, and on none without `onShow`.
     */
    onShow?: (item: UploadItem) => void;
    canShow?: (item: UploadItem) => boolean;
    /** Cancels every upload waiting or under way. */
    onCancelAll: () => void;
    /** Forgets every upload that has ended. */
    onClear: () => void;
}

interface UploadRowProps {
    item: UploadItem;
    onCancel: (id: number) => void;
    onRetry: (id: number) => void;
    /** Shows the finished upload in its folder; missing when it can't be. */
    onShow?: (item: UploadItem) => void;
}

const isActive = (item: UploadItem) => item.status === "queued" || item.status === "uploading";

/**
 * How many files are waiting or uploading, uploaded, failed and cancelled, a folder's files counted
 * one by one, and how much of the uploads waiting or under way has been sent. A folder that failed
 * or was cancelled with none of its files left counts as one, being a folder that couldn't be made.
 */
const summarize = (items: UploadItem[]) => {
    const count = { active: 0, done: 0, failed: 0, cancelled: 0 };
    let size = 0;
    let sent = 0;
    let measured = false;

    items.forEach((item) => {
        const total = item.kind === "file" ? item.file.size : item.size;

        if (item.kind === "file") {
            if (item.status === "queued" || item.status === "uploading") {
                count.active += 1;
            } else {
                count[item.status] += 1;
            }
        } else {
            const left = (item.files ?? 0) - item.done - item.failed;

            count.done += item.done;
            count.failed += item.status === "failed" ? Math.max(item.failed, 1) : item.failed;

            if (isActive(item)) {
                count.active += left;
            } else if (item.status === "cancelled") {
                count.cancelled += Math.max(left, 1);
            }
        }

        if (isActive(item)) {
            size += total;
            sent += total * (item.progress ?? 0);
            measured ||= item.progress !== undefined;
        }
    });

    return { count, busy: items.some(isActive), size, sent, measured };
};

const describeFolder = (item: FolderUploadItem, { text }: Locale) => {
    const { folder, status, files = 0, done, failed, skipped, error } = item;
    const skippedText = skipped > 0 && text.uploadFolderSkipped(skipped);
    const parts = (list: (string | false | undefined)[]) =>
        joinIsolated(list.filter((part): part is string => !!part));

    switch (status) {
        case "queued":
            return parts([text.uploadQueued, folder.name]);
        case "uploading":
            return parts([
                item.files === undefined ? text.uploadPreparing : text.uploadFolderProgress(done, files),
                folder.name,
            ]);
        case "done":
            return parts([text.uploadFolderDone(files), skippedText, folder.name]);
        case "cancelled":
            return parts([
                text.uploadCancelled,
                item.files !== undefined && text.uploadFolderProgress(done, files),
                folder.name,
            ]);
        case "failed":
            return parts([failed > 0 && text.uploadFolderFailed(failed, files), error]) || text.uploadFailed;
    }
};

const describeFailure = ({ kind, files, error }: UploadFailure, text: UploadLocaleText) => {
    if (kind === "folder") {
        return joinIsolated([text.uploadFailedFolder(files), ...(error === undefined ? [] : [error])]);
    }

    return error === undefined ? text.uploadFailed : isolate(error);
};

/** What failed in a folder uploaded, each by its path inside the folder, with why. */
const FailureList = ({ item, id }: { item: FolderUploadItem; id: string }) => {
    const { text } = useLocale();

    return (
        <div className={styles.failureArea}>
            <div className={panel.slot} />
            <ul id={id} aria-label={text.uploadFailures(isolate(item.name))} className={styles.failureList}>
                {item.failures.map((failure, index) => {
                    const name = failure.path[failure.path.length - 1];

                    return (
                        // Only ever added to, and emptied as the folder is tried again.
                        <li key={index} className={styles.failure}>
                            <div className={styles.failureIcon}>
                                {failure.kind === "file" ? (
                                    <FileTypeIcon fileName={name} size="1rem" />
                                ) : (
                                    <FolderTypeIcon folderName={name} size="1rem" />
                                )}
                            </div>
                            <div className={panel.text}>
                                <Text variant="body2" noWrap>
                                    <bdi>{joinIsolated(failure.path, " / ")}</bdi>
                                </Text>
                                <Text variant="caption" color="error" noWrap>
                                    {describeFailure(failure, text)}
                                </Text>
                            </div>
                        </li>
                    );
                })}
                {item.moreFailures > 0 && (
                    <li className={styles.failure}>
                        <Text variant="caption" color="secondary">
                            {text.uploadFailuresMore(item.moreFailures)}
                        </Text>
                    </li>
                )}
            </ul>
        </div>
    );
};

const describeFile = ({ file, folder, status, progress, error }: FileUploadItem, { text, formatSize }: Locale) => {
    switch (status) {
        case "queued":
            return joinIsolated([text.uploadQueued, folder.name]);
        case "uploading": {
            if (progress === undefined) {
                return joinIsolated([text.uploadUploading, folder.name]);
            }

            const sent = formatSize(Math.round(file.size * progress));

            return joinIsolated([text.uploadProgress(isolate(sent), isolate(formatSize(file.size))), folder.name]);
        }
        case "done":
            return joinIsolated([formatSize(file.size), folder.name]);
        case "cancelled":
            return joinIsolated([text.uploadCancelled, folder.name]);
        case "failed":
            return error === undefined ? text.uploadFailed : isolate(error);
    }
};

const UploadRow = ({ item, onCancel, onRetry, onShow }: UploadRowProps) => {
    const { id, status, progress } = item;
    const name = item.kind === "file" ? item.file.name : item.name;
    const failures = item.kind === "folder" ? item.failures : [];
    const locale = useLocale();
    const { text } = locale;
    const [showFailures, setShowFailures] = useState(false);
    const failuresId = useId();

    let action: ReactNode;

    if (isActive(item)) {
        action = (
            <TooltipIconButton size="small" label={text.uploadCancel(isolate(name))} onClick={() => onCancel(id)}>
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
        );
    } else if (status === "done") {
        action = (
            <>
                {onShow && (
                    <TooltipIconButton
                        size="small"
                        label={text.uploadShow(isolate(name))}
                        onClick={() => onShow(item)}
                    >
                        <Icon name="folderOpen" fontSize="small" />
                    </TooltipIconButton>
                )}
                <div className={styles.done}>
                    <Icon name="check" fontSize="small" label={text.uploadDone} />
                </div>
            </>
        );
    } else {
        action = (
            <TooltipIconButton size="small" label={text.uploadRetry(isolate(name))} onClick={() => onRetry(id)}>
                <Icon name="refresh" fontSize="small" />
            </TooltipIconButton>
        );
    }

    return (
        <li>
            <div className={cx(panel.row, fmClasses.taskRow)}>
                <div className={panel.slot}>
                    {item.kind === "file" ? <FileTypeIcon fileName={name} /> : <FolderTypeIcon folderName={name} />}
                </div>
                <div className={panel.text}>
                    <Text variant="body2" noWrap>
                        <bdi>{name}</bdi>
                    </Text>
                    {status === "uploading" && (
                        <LinearProgress
                            variant={progress === undefined ? "indeterminate" : "determinate"}
                            value={(progress ?? 0) * 100}
                            className={panel.bar}
                        />
                    )}
                    <Text variant="caption" color={status === "failed" ? "error" : "secondary"} noWrap>
                        {item.kind === "file" ? describeFile(item, locale) : describeFolder(item, locale)}
                    </Text>
                </div>
                {failures.length > 0 && (
                    <TooltipIconButton
                        size="small"
                        label={
                            showFailures
                                ? text.uploadFailuresHide(isolate(name))
                                : text.uploadFailuresShow(isolate(name))
                        }
                        aria-expanded={showFailures}
                        aria-controls={failuresId}
                        onClick={() => setShowFailures((prev) => !prev)}
                    >
                        <Icon name="expand" fontSize="small" className={styles.failuresToggleIcon} />
                    </TooltipIconButton>
                )}
                {action}
            </div>
            {item.kind === "folder" && (
                <Collapse in={showFailures && failures.length > 0}>
                    <FailureList item={item} id={failuresId} />
                </Collapse>
            )}
        </li>
    );
};

/**
 * The upload queue at a glance: a summary that can fold the list away, and a row per file or folder
 * with its progress or how it ended, to cancel it or try it again, or once done, to show it where it
 * went. It knows nothing of where it's shown, so it can sit under any view of files. The close
 * button cancels whatever is still uploading, which stays listed to try again, and once nothing
 * is, forgets the list.
 */
const UploadPanel = ({ items, onCancel, onRetry, onShow, canShow, onCancelAll, onClear }: UploadPanelProps) => {
    const [expanded, setExpanded] = useState(true);
    const { text, formatSize } = useLocale();
    const { count, busy, size, sent, measured } = summarize(items);

    let title: string;
    let status: ReactNode;

    // With no file waiting or uploading yet, folders are being read, or empty ones made.
    if (busy) {
        title = count.active > 0 ? text.uploadsActive(count.active) : text.uploadsPreparing;
        status = (
            <CircularProgress
                size={20}
                variant={measured ? "determinate" : "indeterminate"}
                value={size > 0 ? (sent / size) * 100 : 0}
            />
        );
    } else if (count.failed > 0) {
        title = text.uploadsFailed(count.failed);
        status = <Icon name="info" color="error" />;
    } else if (count.done > 0) {
        title = text.uploadsDone(count.done);
        status = <Icon name="check" color="primary" />;
    } else {
        title = text.uploadsCancelled;
        status = <Icon name="upload" color="disabled" />;
    }

    // What the title leaves out; nothing while only folders are being read.
    let detail: string;

    if (busy) {
        detail = size > 0 ? text.uploadProgress(isolate(formatSize(Math.round(sent))), isolate(formatSize(size))) : "";
    } else {
        detail = joinIsolated(
            [
                count.failed > 0 && count.done > 0 && text.uploadsDoneCount(count.done),
                count.cancelled > 0 && count.failed + count.done > 0 && text.uploadsCancelledCount(count.cancelled),
            ].filter((part): part is string => !!part),
        );
    }

    return (
        <section className={cx(panel.panel, fmClasses.taskPanel, fmClasses.uploadPanel)} aria-label={text.uploads}>
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
                    label={expanded ? text.uploadsHide : text.uploadsShow}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    <Icon name="expand" fontSize="small" className={panel.toggleIcon} />
                </TooltipIconButton>
                <TooltipIconButton
                    label={busy ? text.uploadsCancelAll : text.uploadsClose}
                    onClick={busy ? onCancelAll : onClear}
                >
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </div>
            <Collapse in={expanded}>
                <ul className={panel.list}>
                    {items.map((item) => (
                        <UploadRow
                            key={item.id}
                            item={item}
                            onCancel={onCancel}
                            onRetry={onRetry}
                            onShow={onShow && (!canShow || canShow(item)) ? onShow : undefined}
                        />
                    ))}
                </ul>
            </Collapse>
        </section>
    );
};

export default UploadPanel;
