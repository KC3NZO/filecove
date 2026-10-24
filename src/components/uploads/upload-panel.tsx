import { useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import {
    panelBarSx,
    panelHeaderSx,
    panelListSx,
    panelRowSx,
    panelSlotSx,
    panelSx,
    panelTextSx,
    panelTitleSx,
    panelToggleIconSx,
} from "../../styles/panel";
import { isolate, joinIsolated } from "../../utils/bidi";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";

import type { Locale, UploadItem, UploadStatus } from "../../types";

interface UploadPanelProps {
    items: UploadItem[];
    onCancel: (id: number) => void;
    onRetry: (id: number) => void;
    /** Cancels every upload waiting or under way. */
    onCancelAll: () => void;
    /** Forgets every upload that has ended. */
    onClear: () => void;
}

interface UploadRowProps {
    item: UploadItem;
    onCancel: (id: number) => void;
    onRetry: (id: number) => void;
}

// The same width as a small IconButton, so a done row's check lines up with the other rows' buttons.
const doneSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 30,
    color: "primary.main",
};

const isActive = (item: UploadItem) => item.status === "queued" || item.status === "uploading";

/** How many uploads are at each status, and how much of those waiting or under way has been sent. */
const summarize = (items: UploadItem[]) => {
    const count: Record<UploadStatus, number> = { queued: 0, uploading: 0, done: 0, failed: 0, cancelled: 0 };
    let size = 0;
    let sent = 0;
    let measured = false;

    items.forEach((item) => {
        count[item.status] += 1;

        if (isActive(item)) {
            size += item.file.size;
            sent += item.file.size * (item.progress ?? 0);
            measured ||= item.progress !== undefined;
        }
    });

    return { count, active: count.queued + count.uploading, size, sent, measured };
};

const describeRow = ({ file, folder, status, progress, error }: UploadItem, { text, formatSize }: Locale) => {
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

const UploadRow = ({ item, onCancel, onRetry }: UploadRowProps) => {
    const { id, file, status, progress } = item;
    const locale = useLocale();
    const { text } = locale;

    let action: ReactNode;

    if (isActive(item)) {
        action = (
            <TooltipIconButton size="small" label={text.uploadCancel(isolate(file.name))} onClick={() => onCancel(id)}>
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
        );
    } else if (status === "done") {
        action = (
            <Box sx={doneSx}>
                <Icon name="check" fontSize="small" titleAccess={text.uploadDone} />
            </Box>
        );
    } else {
        action = (
            <TooltipIconButton size="small" label={text.uploadRetry(isolate(file.name))} onClick={() => onRetry(id)}>
                <Icon name="refresh" fontSize="small" />
            </TooltipIconButton>
        );
    }

    return (
        <Box component="li" sx={panelRowSx}>
            <Box sx={panelSlotSx}>
                <FileTypeIcon fileName={file.name} />
            </Box>
            <Box sx={panelTextSx}>
                <Typography variant="body2" noWrap>
                    <bdi>{file.name}</bdi>
                </Typography>
                {status === "uploading" && (
                    <LinearProgress
                        variant={progress === undefined ? "indeterminate" : "determinate"}
                        value={(progress ?? 0) * 100}
                        sx={panelBarSx}
                    />
                )}
                <Typography variant="caption" color={status === "failed" ? "error" : "text.secondary"} noWrap>
                    {describeRow(item, locale)}
                </Typography>
            </Box>
            {action}
        </Box>
    );
};

/**
 * The upload queue at a glance: a summary that can fold the list of files away, and a row per file
 * with its progress or how it ended, to cancel it or try it again. It knows nothing of where it's
 * shown, so it can sit under any view of files. The close button cancels whatever is still
 * uploading, which stays listed to try again, and once nothing is, forgets the list.
 */
const UploadPanel = ({ items, onCancel, onRetry, onCancelAll, onClear }: UploadPanelProps) => {
    const [expanded, setExpanded] = useState(true);
    const { text, formatSize } = useLocale();
    const { count, active, size, sent, measured } = summarize(items);

    let title: string;
    let status: ReactNode;

    if (active > 0) {
        title = text.uploadsActive(active);
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

    // What the title leaves out.
    const detail =
        active > 0
            ? text.uploadProgress(isolate(formatSize(Math.round(sent))), isolate(formatSize(size)))
            : joinIsolated(
                  [
                      count.failed > 0 && count.done > 0 && text.uploadsDoneCount(count.done),
                      count.cancelled > 0 &&
                          count.failed + count.done > 0 &&
                          text.uploadsCancelledCount(count.cancelled),
                  ].filter((part): part is string => !!part),
              );

    return (
        <Box component="section" sx={panelSx} aria-label={text.uploads}>
            <Box sx={panelHeaderSx}>
                <Box sx={panelSlotSx}>{status}</Box>
                <Box sx={panelTextSx}>
                    <Typography variant="body2" noWrap sx={panelTitleSx} aria-live="polite">
                        {title}
                    </Typography>
                    {detail && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {detail}
                        </Typography>
                    )}
                </Box>
                <TooltipIconButton
                    label={expanded ? text.uploadsHide : text.uploadsShow}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    <Icon name="expand" fontSize="small" sx={panelToggleIconSx} />
                </TooltipIconButton>
                <TooltipIconButton
                    label={active > 0 ? text.uploadsCancelAll : text.uploadsClose}
                    onClick={active > 0 ? onCancelAll : onClear}
                >
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </Box>
            <Collapse in={expanded}>
                <Box component="ul" sx={panelListSx}>
                    {items.map((item) => (
                        <UploadRow key={item.id} item={item} onCancel={onCancel} onRetry={onRetry} />
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
};

export default UploadPanel;
