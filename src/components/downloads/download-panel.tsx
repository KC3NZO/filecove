import { useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

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
import { FileTypeIcon, FolderTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";

import type { DownloadItem, DownloadStatus, Locale } from "../../types";

interface DownloadPanelProps {
    /** The downloads to show, in the order asked for. */
    items: DownloadItem[];
    onCancel: (id: number) => void;
    onRetry: (id: number) => void;
    /** Starts a ready download, from the click on its button. */
    onSave: (id: number) => void;
    /** Cancels every download waiting or being prepared. */
    onCancelAll: () => void;
    /** Forgets every failed and ready download. */
    onClear: () => void;
}

interface DownloadRowProps {
    item: DownloadItem;
    onCancel: (id: number) => void;
    onRetry: (id: number) => void;
    onSave: (id: number) => void;
}

const isActive = (item: DownloadItem) => item.status === "queued" || item.status === "preparing";

/**
 * How many downloads are at each status, and how much of those waiting or being prepared has come,
 * measured only once every one of them has reported its total.
 */
const summarize = (items: DownloadItem[]) => {
    const count: Record<DownloadStatus, number> = { queued: 0, preparing: 0, ready: 0, failed: 0 };
    let loaded = 0;
    let total = 0;
    let measured = true;

    items.forEach((item) => {
        count[item.status] += 1;

        if (isActive(item)) {
            loaded += item.progress?.loaded ?? 0;
            total += item.progress?.total ?? 0;
            measured &&= item.progress !== undefined;
        }
    });

    const active = count.queued + count.preparing;

    return { count, active, fraction: active > 0 && measured && total > 0 ? loaded / total : null };
};

const describeRow = ({ entries, status, progress, error }: DownloadItem, { text, formatSize }: Locale) => {
    switch (status) {
        case "queued":
            return text.downloadQueued;
        case "preparing":
            return progress
                ? text.downloadProgress(isolate(formatSize(progress.loaded)), isolate(formatSize(progress.total)))
                : text.downloadPreparing;
        case "ready":
            return text.downloadReady;
        case "failed":
            return error === undefined ? text.downloadFailed(entries.length) : isolate(error);
    }
};

const DownloadRow = ({ item, onCancel, onRetry, onSave }: DownloadRowProps) => {
    const { id, entries, status, progress } = item;
    const locale = useLocale();
    const { text } = locale;
    const [only] = entries;
    const count = entries.length;
    const name = isolate(only.name);

    let icon: ReactNode;

    if (count > 1) {
        icon = <Icon name="copy" fontSize="small" color="action" />;
    } else if (only.kind === "folder") {
        icon = <FolderTypeIcon folderName={only.name} />;
    } else {
        icon = <FileTypeIcon fileName={only.name} />;
    }

    let action: ReactNode;

    if (isActive(item)) {
        action = (
            <TooltipIconButton size="small" label={text.downloadCancel(count, name)} onClick={() => onCancel(id)}>
                <Icon name="close" fontSize="small" />
            </TooltipIconButton>
        );
    } else if (status === "ready") {
        action = (
            <TooltipIconButton
                size="small"
                color="primary"
                label={text.downloadSave(count, name)}
                onClick={() => onSave(id)}
            >
                <Icon name="download" fontSize="small" />
            </TooltipIconButton>
        );
    } else {
        action = (
            <TooltipIconButton size="small" label={text.downloadRetry(count, name)} onClick={() => onRetry(id)}>
                <Icon name="refresh" fontSize="small" />
            </TooltipIconButton>
        );
    }

    return (
        <Box component="li" sx={panelRowSx}>
            <Box sx={panelSlotSx}>{icon}</Box>
            <Box sx={panelTextSx}>
                <Typography variant="body2" noWrap>
                    {count > 1 ? text.downloadItems(count) : <bdi>{only.name}</bdi>}
                </Typography>
                {status === "preparing" && (
                    <LinearProgress
                        variant={progress ? "determinate" : "indeterminate"}
                        value={progress ? (progress.loaded / progress.total) * 100 : 0}
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
 * Downloads that have taken a moment, or need the user: a summary that can fold the list away, and
 * a row per download with what it's at, to cancel it, try it again, or start it when the browser
 * wouldn't on its own. A download leaves once the browser has the file, and the browser's own
 * downloads show it from there. It knows nothing of where it's shown, so it can sit under any
 * view of files. The close button cancels whatever is still being prepared, and once nothing is,
 * forgets the rest.
 */
const DownloadPanel = ({ items, onCancel, onRetry, onSave, onCancelAll, onClear }: DownloadPanelProps) => {
    const [expanded, setExpanded] = useState(true);
    const { text } = useLocale();
    const { count, active, fraction } = summarize(items);

    let title: string;
    let status: ReactNode;

    if (active > 0) {
        title = text.downloadsPreparing(active);
        status = (
            <CircularProgress
                size={20}
                variant={fraction === null ? "indeterminate" : "determinate"}
                value={(fraction ?? 0) * 100}
            />
        );
    } else if (count.ready > 0) {
        title = text.downloadsReady(count.ready);
        status = <Icon name="download" color="primary" />;
    } else {
        title = text.downloadsFailed(count.failed);
        status = <Icon name="info" color="error" />;
    }

    // What the title leaves out.
    const detail = joinIsolated(
        [
            active > 0 && count.ready > 0 && text.downloadsReadyCount(count.ready),
            active + count.ready > 0 && count.failed > 0 && text.downloadsFailedCount(count.failed),
        ].filter((part): part is string => !!part),
    );

    return (
        <Box component="section" sx={panelSx} aria-label={text.downloads}>
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
                    label={expanded ? text.downloadsHide : text.downloadsShow}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((prev) => !prev)}
                >
                    <Icon name="expand" fontSize="small" sx={panelToggleIconSx} />
                </TooltipIconButton>
                <TooltipIconButton
                    label={active > 0 ? text.downloadsCancelAll : text.downloadsClose}
                    onClick={active > 0 ? onCancelAll : onClear}
                >
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </Box>
            <Collapse in={expanded}>
                <Box component="ul" sx={panelListSx}>
                    {items.map((item) => (
                        <DownloadRow
                            key={item.id}
                            item={item}
                            onCancel={onCancel}
                            onRetry={onRetry}
                            onSave={onSave}
                        />
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
};

export default DownloadPanel;
