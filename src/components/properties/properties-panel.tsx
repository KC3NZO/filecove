import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { useProperties } from "../../hooks/use-properties";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { createPropertiesCache } from "../../store/properties-cache";
import { focusOutline, visuallyHiddenSx } from "../../styles/mixins";
import { isolate, joinIsolated } from "../../utils/bidi";
import ToolbarActions from "../buttons/toolbar-actions";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon, FolderTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";

import type { PropertiesCache } from "../../store/properties-cache";
import type {
    EntryTotals,
    FileEntry,
    Locale,
    PropertiesItem,
    PropertyField,
    Requested,
    ToolbarGroup,
} from "../../types";

interface PropertiesPanelProps {
    /** What it shows: one entry, several, or none, which asks for something to be selected. */
    items: readonly PropertiesItem[];
    /** The host's count of its changes, which counts what's in folders again once it settles. */
    changes: number;
    /** Whether the host shows hidden files, which `measure` is told. */
    showHidden: boolean;
    /** Where what the adapters hand over is kept, to outlive the panel; one of its own without it. */
    cache?: PropertiesCache;
    /** Takes the focus as it's set, or as it mounts with it set. */
    takeFocus?: boolean;
    /** The host's actions for what it shows, in its header. */
    actions?: readonly ToolbarGroup[];
    onClose: () => void;
}

interface RowProps {
    label: string;
    children: ReactNode;
}

interface PictureProps {
    item: PropertiesItem;
}

interface SpinnerProps {
    /** What's awaited, for screen readers. */
    label: string;
}

interface FieldValueProps {
    field: PropertyField;
    onCopy: (field: PropertyField & { type: "text" }) => void;
}

interface ContentsProps {
    totals: Requested<EntryTotals>;
    /** The selected files and folders, counted in with what's in the folders; none for one folder. */
    files: number;
    folders: number;
    /** The selected files' sizes added up. */
    bytes: number;
    /** How many folders are counted, which the failure is worded by. */
    counted: number;
    /** Shown while nothing has been counted yet. */
    fallback?: string;
    onRetry: () => void;
}

/** Something copied, for the panel's own live region; `id` counts, so copying twice is heard twice. */
interface Copied {
    message: string;
    id: number;
}

// The side of the square the panel asks the adapter's thumbnail for, in rem: about the width the
// panel's body has, docked or as the overlay. The grid's smaller one shows until this has loaded.
const PICTURE_SIZE = 17;

/** How many of the host's actions with icons show as buttons in the narrow header. */
const INLINE_ACTIONS = 2;

const NO_ACTIONS: readonly ToolbarGroup[] = [];

/** How long the message that something was copied stays for screen readers, in ms. */
const COPIED_FOR = 5000;

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

const rootSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    outline: "none",
    "&:focus-visible": { ...focusOutline, borderRadius: "inherit" },
};

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flexShrink: 0,
    minHeight: 52,
    paddingInlineStart: 2,
    paddingInlineEnd: 1,
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const bodySx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    px: 2,
    pb: 2,
};

const emptySx: SxProps<Theme> = {
    py: 4,
    textAlign: "center",
    color: "text.secondary",
};

const heroSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    pt: 1,
    pb: 2,
    textAlign: "center",
};

// The picture fills the panel's width, and is never taller than it is wide, shrunk to fit and
// never stretched past the width. A smaller thumbnail standing in while the larger loads is drawn
// at the same size, so the swap changes only its sharpness.
const pictureSx: SxProps<Theme> = {
    alignSelf: "stretch",
    "& > img": {
        display: "block",
        width: "100%",
        height: "auto",
        maxHeight: `${PICTURE_SIZE}rem`,
        objectFit: "contain",
        borderRadius: 1,
    },
};

const severalSx: SxProps<Theme> = {
    fontSize: "3.5rem",
};

const nameSx: SxProps<Theme> = {
    maxWidth: "100%",
    fontWeight: 600,
    overflowWrap: "anywhere",
};

const buttonsSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 1,
};

const fieldsSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
    m: 0,
};

// Each group of rows is set apart by a rule above it.
const groupSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
    py: 2,
    borderTop: 1,
    borderColor: "divider",
};

const groupTitleSx: SxProps<Theme> = {
    fontSize: "0.8125rem",
    fontWeight: 600,
};

const rowSx: SxProps<Theme> = {
    minWidth: 0,
    "& > dt": {
        color: "text.secondary",
        fontSize: "0.75rem",
    },
    "& > dd": {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        m: 0,
        fontSize: "0.875rem",
        overflowWrap: "anywhere",
    },
};

const tagsSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    gap: 0.5,
};

const stateSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 1,
    py: 2,
    borderTop: 1,
    borderColor: "divider",
    color: "text.secondary",
    fontSize: "0.875rem",
};

const Row = ({ label, children }: RowProps) => (
    <Box sx={rowSx}>
        <dt>{label}</dt>
        <dd>{children}</dd>
    </Box>
);

/** The file's thumbnail, large, once it has loaded, or else its type icon. */
const Picture = ({ item }: PictureProps) => {
    const thumbnail = useThumbnail(item.entry, item.adapter, "grid", PICTURE_SIZE);

    if (thumbnail) {
        return (
            <Box sx={pictureSx}>
                <img src={thumbnail} alt="" draggable={false} />
            </Box>
        );
    }

    return item.entry.kind === "folder" ? (
        <FolderTypeIcon folderName={item.entry.name} size="4rem" />
    ) : (
        <FileTypeIcon fileName={item.entry.name} size="4rem" />
    );
};

const Spinner = ({ label }: SpinnerProps) => <CircularProgress size={14} aria-label={label} />;

/** A size, with its exact bytes from 1 kB up. */
const describeBytes = ({ text, formatSize, formatBytes }: Locale, bytes: number) =>
    bytes < 1000
        ? formatSize(bytes)
        : text.propertiesSizeExact(isolate(formatSize(bytes)), isolate(formatBytes(bytes)));

/** The type, with the MIME type it was told by, when there's one. */
const typeWithMime = ({ text, describeType }: Locale, entry: FileEntry) =>
    entry.mimeType && entry.kind === "file"
        ? text.propertiesTypeWithMime(isolate(describeType(entry)), isolate(entry.mimeType))
        : describeType(entry);

/** A value of the backend's own, written out in the locale. */
const FieldValue = ({ field, onCopy }: FieldValueProps) => {
    const { text, formatCount, formatSize, formatDate } = useLocale();

    switch (field.type) {
        case "text":
            return (
                <>
                    <bdi>{field.value}</bdi>
                    {field.copyable && (
                        <TooltipIconButton
                            label={text.propertiesCopy(field.label)}
                            size="small"
                            onClick={() => onCopy(field)}
                        >
                            <Icon name="copy" fontSize="small" />
                        </TooltipIconButton>
                    )}
                </>
            );
        case "number":
            return <bdi>{formatCount(field.value)}</bdi>;
        case "size":
            return <bdi>{formatSize(field.value)}</bdi>;
        case "date":
            return <bdi>{formatDate(field.value)}</bdi>;
        case "link":
            return (
                <Link href={field.href} target="_blank" rel="noopener noreferrer">
                    <bdi>{field.value}</bdi>
                </Link>
            );
        case "tags":
            return (
                <Box sx={tagsSx}>
                    {field.value.map((tag) => (
                        <Chip key={tag} size="small" label={<bdi>{tag}</bdi>} />
                    ))}
                </Box>
            );
    }
};

/**
 * What's in folders, counted all the way down, or several entries with what's in their folders, the
 * selected files added in and the selected folders among the folders, counting up while it's
 * counted.
 */
const Contents = ({ totals, files, folders, bytes, counted, fallback, onRetry }: ContentsProps) => {
    const { text, formatSize } = useLocale();

    if (totals.status === "error") {
        return (
            <>
                <bdi>{messageOf(totals.error) ?? text.propertiesCountFailed(counted)}</bdi>
                <Button size="small" onClick={onRetry}>
                    {text.propertiesTryAgain}
                </Button>
            </>
        );
    }

    const sum = totals.status === "ready" ? totals.value : totals.progress;

    return (
        <>
            {sum
                ? text.propertiesTotals(files + sum.files, folders + sum.folders, isolate(formatSize(bytes + sum.size)))
                : fallback}
            {totals.status === "loading" && <Spinner label={text.propertiesCounting} />}
        </>
    );
};

/**
 * An entry's properties, or several entries' together: its picture and name, what the listing
 * says of it (type, size or contents, location, dates, dimensions, length), and what its adapter
 * adds, the fuller entry and properties of the backend's own (`properties`), and what's in folders
 * (`measure`), with the host's actions for it in the header. It knows nothing of where it's shown,
 * so it can sit beside any view of files, and has its own live region, saying what was copied.
 */
const PropertiesPanel = ({
    items,
    changes,
    showHidden,
    cache: given,
    takeFocus,
    actions = NO_ACTIONS,
    onClose,
}: PropertiesPanelProps) => {
    const locale = useLocale();
    const { text, formatDate, formatNumber, formatDuration, formatSize } = locale;
    const [own] = useState(createPropertiesCache);
    const cache = given ?? own;
    const { details, totals, retryDetails, retryTotals } = useProperties(items, { cache, changes, showHidden });
    const rootRef = useRef<HTMLElement>(null);
    const titleId = useId();
    const [copied, setCopied] = useState<Copied | null>(null);

    useEffect(() => {
        if (takeFocus) {
            rootRef.current?.focus();
        }
    }, [takeFocus]);

    useEffect(() => {
        if (!copied) {
            return;
        }

        const timer = window.setTimeout(() => setCopied(null), COPIED_FOR);

        return () => window.clearTimeout(timer);
    }, [copied]);

    const copy = (field: PropertyField & { type: "text" }) => {
        navigator.clipboard.writeText(field.value).then(
            () => setCopied((prev) => ({ message: text.propertiesCopied(field.label), id: (prev?.id ?? 0) + 1 })),
            () => undefined,
        );
    };

    const [only] = items;
    const single = items.length === 1 ? only : undefined;
    // What `properties` handed over, or while a changed entry is asked about again, what it handed
    // over before.
    const handed =
        details?.status === "ready" ? details.value : details?.status === "loading" ? details.progress : undefined;
    const fuller = handed?.entry;
    const fresh = details?.status === "ready";
    // The fuller entry `properties` hands over, over the listed one, for what the listing left out.
    // One handed over before the entry changed only fills in what the listing leaves out, so its
    // new size and date show at once.
    const entry = useMemo(() => {
        if (!single || !fuller) {
            return single?.entry;
        }

        return fresh ? { ...single.entry, ...fuller } : { ...fuller, ...single.entry };
    }, [single, fuller, fresh]);

    let body: ReactNode;

    if (items.length === 0) {
        body = (
            <Typography variant="body2" sx={emptySx}>
                {text.propertiesNothingSelected}
            </Typography>
        );
    } else {
        const files = items.filter((item) => item.entry.kind === "file");
        const folders = items.length - files.length;
        const bytes = files.reduce((sum, item) => sum + (item.entry.size ?? 0), 0);
        const [firstLocation] = items.map((item) => item.location);
        const location = items.every((item) => item.location === firstLocation)
            ? firstLocation
            : text.propertiesSeveralFolders;
        const media = entry?.kind === "file" ? entry.media : undefined;
        const rows: ReactNode[] = [];

        if (entry) {
            rows.push(
                <Row key="type" label={text.propertiesType}>
                    {typeWithMime(locale, entry)}
                </Row>,
            );
        }

        if (entry?.kind === "file") {
            if (entry.size !== undefined) {
                rows.push(
                    <Row key="size" label={text.propertiesSize}>
                        {describeBytes(locale, entry.size)}
                    </Row>,
                );
            }
        } else if (entry) {
            // One folder: what's in it, counted when its adapter can, or else how many entries it holds.
            const childCount = entry.childCount ?? single?.childCount;
            const held = childCount === undefined ? undefined : text.propertiesItems(childCount);

            if (totals || held) {
                rows.push(
                    <Row key="contents" label={text.propertiesContents}>
                        {totals ? (
                            <Contents
                                totals={totals}
                                files={0}
                                folders={0}
                                bytes={0}
                                counted={1}
                                fallback={held}
                                onRetry={retryTotals}
                            />
                        ) : (
                            held
                        )}
                    </Row>,
                );
            }
        } else {
            // Several: files alone add up at once, and folders are counted in when their adapters can.
            const kinds = text.propertiesKinds(files.length, folders);

            rows.push(
                <Row key="contents" label={text.propertiesContents}>
                    {folders === 0 && text.propertiesTotals(files.length, 0, isolate(formatSize(bytes)))}
                    {folders > 0 && totals && (
                        <Contents
                            totals={totals}
                            files={files.length}
                            folders={folders}
                            bytes={bytes}
                            counted={folders}
                            fallback={kinds}
                            onRetry={retryTotals}
                        />
                    )}
                    {folders > 0 && !totals && kinds}
                </Row>,
            );
        }

        if (location) {
            rows.push(
                <Row key="location" label={text.propertiesLocation}>
                    {location}
                </Row>,
            );
        }

        if (entry?.modifiedAt) {
            rows.push(
                <Row key="modified" label={text.propertiesModified}>
                    <bdi>{formatDate(entry.modifiedAt)}</bdi>
                </Row>,
            );
        }

        if (entry?.createdAt) {
            rows.push(
                <Row key="created" label={text.propertiesCreated}>
                    <bdi>{formatDate(entry.createdAt)}</bdi>
                </Row>,
            );
        }

        if (media?.width !== undefined && media.height !== undefined) {
            rows.push(
                <Row key="dimensions" label={text.propertiesDimensions}>
                    {joinIsolated([formatNumber(media.width), formatNumber(media.height)], " × ")}
                </Row>,
            );
        }

        if (media?.duration !== undefined) {
            rows.push(
                <Row key="duration" label={text.propertiesDuration}>
                    <bdi>{formatDuration(media.duration)}</bdi>
                </Row>,
            );
        }

        let backendGroups: ReactNode = null;

        if (details?.status === "loading" && !handed) {
            backendGroups = (
                <Box sx={stateSx}>
                    <Spinner label={text.propertiesLoading} />
                </Box>
            );
        } else if (details?.status === "error") {
            backendGroups = (
                <Box sx={stateSx} role="alert">
                    <bdi>{messageOf(details.error) ?? text.propertiesFailed}</bdi>
                    <Button size="small" onClick={retryDetails}>
                        {text.propertiesTryAgain}
                    </Button>
                </Box>
            );
        } else if (handed) {
            backendGroups = handed.groups?.map(
                (group) =>
                    group.fields.length > 0 && (
                        <Box key={group.id} sx={groupSx}>
                            {group.title && (
                                <Typography component="h3" sx={groupTitleSx}>
                                    {group.title}
                                </Typography>
                            )}
                            <Box component="dl" sx={fieldsSx}>
                                {group.fields.map((field) => (
                                    <Row key={field.id} label={field.label}>
                                        <FieldValue field={field} onCopy={copy} />
                                    </Row>
                                ))}
                            </Box>
                        </Box>
                    ),
            );
        }

        body = (
            <>
                <Box sx={heroSx}>
                    {single ? <Picture item={single} /> : <Icon name="copy" color="action" sx={severalSx} />}
                    <Typography component="p" sx={nameSx}>
                        {entry ? <bdi>{entry.name}</bdi> : text.propertiesItems(items.length)}
                    </Typography>
                    {(single?.rename || single?.openLocation) && (
                        <Box sx={buttonsSx}>
                            {single.openLocation && (
                                <Button size="small" color="inherit" variant="outlined" onClick={single.openLocation}>
                                    {text.propertiesOpenLocation}
                                </Button>
                            )}
                            {single.rename && (
                                <Button size="small" color="inherit" variant="outlined" onClick={single.rename}>
                                    {text.propertiesRename}
                                </Button>
                            )}
                        </Box>
                    )}
                </Box>
                <Box sx={groupSx}>
                    <Box component="dl" sx={fieldsSx}>
                        {rows}
                    </Box>
                </Box>
                {backendGroups}
            </>
        );
    }

    return (
        <Box component="aside" ref={rootRef} tabIndex={-1} aria-labelledby={titleId} sx={rootSx}>
            <Box sx={headerSx}>
                <Typography id={titleId} component="h2" noWrap sx={titleSx}>
                    {text.properties}
                </Typography>
                <ToolbarActions groups={actions} moreLabel={text.propertiesMoreActions} inline={INLINE_ACTIONS} />
                <TooltipIconButton label={text.propertiesClose} onClick={onClose}>
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </Box>
            <Box sx={bodySx}>{body}</Box>
            <Box role="status" sx={visuallyHiddenSx}>
                {copied && <span key={copied.id}>{copied.message}</span>}
            </Box>
        </Box>
    );
};

export default PropertiesPanel;
