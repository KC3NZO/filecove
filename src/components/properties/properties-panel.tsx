import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
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
import { NO_ERRORS } from "../../utils/field-errors";
import { formatValue, hasEditor, isEmptyValue, readValue } from "../../utils/property-value";
import ToolbarActions from "../buttons/toolbar-actions";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon, FolderTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import PropertyDisplay from "./property-display";
import PropertyEditor from "./property-editor";

import type { PropertiesCache } from "../../store/properties-cache";
import type {
    EditableField,
    EntryTotals,
    FileEntry,
    Locale,
    PropertiesItem,
    PropertyDefinition,
    PropertyDefinitionGroup,
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
    /**
     * Shown inside a host's own view of one entry, which has its picture, its name and a way back
     * already, as the media manager's asset view does: no header, picture or name of its own.
     */
    embedded?: boolean;
    /**
     * Whether it shows its own rows, the type, size, location, dates and dimensions, before the
     * backend's groups. The media manager leaves them out, as what an asset shows is the app's.
     */
    ownRows?: boolean;
    /**
     * The app's own definitions of what one entry shows, in groups, in place of the backend's own
     * groups: each property read from the `values` the adapter's `properties` hands over by its
     * `field`, or from the entry itself, and shown, edited and saved as its type, its kind and its
     * functions say. Without them, the backend's groups show as the adapter describes them.
     */
    definitions?: readonly PropertyDefinitionGroup[];
    /** Closes the panel, from its header's ✕; not shown while `embedded`. */
    onClose?: () => void;
}

interface RowProps {
    label: string;
    /** The label's id, for a field edited in the row. */
    labelId?: string;
    children: ReactNode;
}

interface PictureProps {
    item: PropertiesItem;
    /** The side of the square asked of the adapter, in rem. */
    size: number;
}

interface SpinnerProps {
    /** What's awaited, for screen readers. */
    label: string;
}

interface FieldValueProps {
    field: PropertyField;
    /** Copies a value, saying so by its property's label. */
    onCopy: (label: string, value: string) => void;
    /** Opens the field for editing; missing when it can't be edited. */
    onEdit?: () => void;
    /** Takes the focus as its Edit button mounts, given back to it as its editing closes. */
    editRef?: (button: HTMLButtonElement | null) => void;
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

/**
 * Something said from the panel's own live region, a value copied or a field saved; `id` counts,
 * so the same thing twice is heard twice.
 */
interface Said {
    message: string;
    id: number;
}

/** The field being edited, by its id or its definition's `field`, of the entry with that id. */
interface Editing {
    entryId: string;
    fieldId: string;
}

interface CopyButtonProps {
    label: string;
    value: string;
    onCopy: (label: string, value: string) => void;
}

// The sides of the square the panel asks the adapter's thumbnail for, in rem, smallest first: the
// smallest as wide as the panel's body, about the width it has docked at first or as the overlay,
// and a larger one as a resized panel is wider, up to the widest it can be made (480px less the
// body's padding is 28rem), so a panel being resized doesn't ask again for every pixel. The grid's
// smaller one shows until the picture has loaded.
const PICTURE_SIZES: readonly number[] = [18, 28];

/** How many of the host's actions with icons show as buttons in the narrow header. */
const INLINE_ACTIONS = 2;

const NO_ACTIONS: readonly ToolbarGroup[] = [];
const NO_VALUES: Readonly<Record<string, unknown>> = {};

/** How long a message from the panel's live region stays for screen readers, in ms. */
const SAID_FOR = 5000;

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

/** A field of the backend's own the user can change, as the definition the editor takes. */
const definitionOf = (field: EditableField): PropertyDefinition =>
    field.type === "text"
        ? {
              field: field.id,
              label: field.label,
              type: "string",
              editable: true,
              multiline: field.multiline,
              maxLength: field.maxLength,
          }
        : { field: field.id, label: field.label, type: "string", multiple: true, editable: true };

const rootSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    outline: "none",
    "&:focus-visible": { ...focusOutline, borderRadius: "inherit" },
};

// Inside a host's view, which scrolls it with the rest: as tall as what it holds, its first group's
// rule left out, as the host's own heading sets it apart.
const embeddedSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    outline: "none",
    "& > div:first-of-type": { overflowY: "visible", px: 0 },
    "& > div:first-of-type > div:first-of-type": { borderTop: 0, pt: 0 },
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

// The picture fills the panel's width, and is never taller than it is wide, shrunk to fit. A
// smaller thumbnail standing in while the larger loads is drawn at the same size, so the swap
// changes only its sharpness.
const pictureSx: SxProps<Theme> = {
    alignSelf: "stretch",
    containerType: "inline-size",
    "& > img": {
        display: "block",
        width: "100%",
        height: "auto",
        maxHeight: "100cqi",
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
    // A property with no label is its value alone, as the app's own `render` may draw it.
    "& > dt:empty": { display: "none" },
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

const notSetSx: SxProps<Theme> = {
    color: "text.secondary",
};

// The app's own `render` takes the row's whole width, below its label.
const customSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.75,
    width: "100%",
    minWidth: 0,
};

const saveErrorSx: SxProps<Theme> = {
    width: "100%",
    color: "error.main",
    fontSize: "0.75rem",
};

// The checkbox's own padding, kept small, so it sits in the row as a value does.
const toggleSx: SxProps<Theme> = {
    p: 0.5,
    marginInlineStart: "-4px",
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

const Row = ({ label, labelId, children }: RowProps) => (
    <Box sx={rowSx}>
        <dt id={labelId}>{label}</dt>
        <dd>{children}</dd>
    </Box>
);

/** The file's thumbnail, large, once it has loaded, or else its type icon. */
const Picture = ({ item, size }: PictureProps) => {
    const thumbnail = useThumbnail(item.entry, item.adapter, "grid", size);

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

const CopyButton = ({ label, value, onCopy }: CopyButtonProps) => {
    const { text } = useLocale();

    return (
        <TooltipIconButton label={text.propertiesCopy(label)} size="small" onClick={() => onCopy(label, value)}>
            <Icon name="copy" fontSize="small" />
        </TooltipIconButton>
    );
};

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
const FieldText = ({ field, onCopy }: FieldValueProps) => {
    const { formatCount, formatSize, formatDate } = useLocale();

    switch (field.type) {
        case "text":
            return (
                <>
                    <bdi>{field.value}</bdi>
                    {field.copyable && <CopyButton label={field.label} value={field.value} onCopy={onCopy} />}
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

/** Whether a field can be changed in the properties, by its type and the backend's say. */
const isEditable = (field: PropertyField): field is EditableField =>
    (field.type === "text" || field.type === "tags") && !!field.editable;

/** A value of the backend's own, written out in the locale, with its Edit button when it can be changed. */
const FieldValue = ({ field, onCopy, onEdit, editRef }: FieldValueProps) => {
    const { text } = useLocale();
    const empty = field.type === "text" || field.type === "tags" ? field.value.length === 0 : false;

    if (!onEdit) {
        return <FieldText field={field} onCopy={onCopy} />;
    }

    return (
        <>
            {empty ? (
                <Box component="span" sx={notSetSx}>
                    {text.propertiesNotSet}
                </Box>
            ) : (
                <FieldText field={field} onCopy={onCopy} />
            )}
            <TooltipIconButton ref={editRef} label={text.propertiesEdit(field.label)} size="small" onClick={onEdit}>
                <Icon name="edit" fontSize="small" />
            </TooltipIconButton>
        </>
    );
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
 * (`measure`), with the host's actions for it in the header. The backend's fields it marks editable
 * are changed in place and saved (`updateProperties`). It knows nothing of where it's shown, so it
 * can sit beside any view of files, and has its own live region, saying what was copied or saved.
 */
const PropertiesPanel = ({
    items,
    changes,
    showHidden,
    cache: given,
    takeFocus,
    actions = NO_ACTIONS,
    embedded = false,
    ownRows = true,
    definitions,
    onClose,
}: PropertiesPanelProps) => {
    const locale = useLocale();
    const { text, formatDate, formatNumber, formatDuration, formatSize } = locale;
    const [own] = useState(createPropertiesCache);
    const cache = given ?? own;
    const { details, totals, retryDetails, retryTotals } = useProperties(items, {
        cache,
        changes,
        showHidden,
        measures: ownRows,
    });
    const rootRef = useRef<HTMLElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [pictureSize, setPictureSize] = useState(PICTURE_SIZES[0]);
    const titleId = useId();
    const fieldId = useId();
    const [said, setSaid] = useState<Said | null>(null);
    const [editing, setEditing] = useState<Editing | null>(null);
    // The field whose Edit button takes the focus back as its editing closes, while nothing else
    // has taken it meanwhile.
    const returnFocus = useRef<string | null>(null);
    const mounted = useRef(false);

    useEffect(() => {
        if (takeFocus) {
            rootRef.current?.focus();
        }
    }, [takeFocus]);

    // The picture asked for follows the body's width, as the panel is resized.
    useLayoutEffect(() => {
        const body = bodyRef.current;

        if (!body) {
            return;
        }

        const measure = () => {
            const style = getComputedStyle(body);
            const width = body.clientWidth - parseFloat(style.paddingInlineStart) - parseFloat(style.paddingInlineEnd);
            const rem = width / (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);

            setPictureSize(PICTURE_SIZES.find((size) => size >= rem) ?? PICTURE_SIZES[PICTURE_SIZES.length - 1]);
        };
        const observer = new ResizeObserver(measure);

        observer.observe(body);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!said) {
            return;
        }

        const timer = window.setTimeout(() => setSaid(null), SAID_FOR);

        return () => window.clearTimeout(timer);
    }, [said]);

    const say = (message: string) => setSaid((prev) => ({ message, id: (prev?.id ?? 0) + 1 }));

    const copy = (label: string, value: string) => {
        navigator.clipboard.writeText(value).then(
            () => say(text.propertiesCopied(label)),
            () => undefined,
        );
    };

    const [only] = items;
    const single = items.length === 1 ? only : undefined;

    // Editing ends as the panel shows something else; an edit being saved, or that failed, is the
    // cache's, and shows again as the panel comes back to it.
    if (editing && editing.entryId !== single?.entry.id) {
        setEditing(null);
    }

    const canEdit = !!single && !!single.adapter.updateProperties && !single.readOnly;

    // Saves a property's new value by its key, a field's id or a definition's `field`, said once
    // saved. From its editor, which closes, the Edit button takes the focus back; from a control
    // changing it in place (a checkbox, the app's own `render`), the focus stays where it is.
    const saveValue = (key: string, label: string, value: unknown, fromEditor: boolean) => {
        if (!single) {
            return Promise.resolve(false);
        }

        if (fromEditor) {
            returnFocus.current = key;
            setEditing(null);
        }

        return cache.saveProperty(single.entry, single.adapter, key, value, single.onUpdated).then((saved) => {
            if (saved && mounted.current) {
                say(text.propertiesSaved(label));
            }

            return saved;
        });
    };

    const cancelEdit = (key: string) => {
        returnFocus.current = key;
        setEditing(null);

        if (single) {
            cache.dropSave(single.entry, single.adapter, key);
        }
    };

    // The Edit button takes the focus back as the field's editing closes, unless the focus went
    // elsewhere first, as it does when leaving the field saved it.
    const editRefFor = (id: string) => (button: HTMLButtonElement | null) => {
        if (button && returnFocus.current === id) {
            returnFocus.current = null;

            if (!document.activeElement || document.activeElement === document.body) {
                button.focus();
            }
        }
    };
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

    // One property of the app's definition, as its row: drawn by its `render` or as its type has it,
    // a yes or no saving as it's toggled, its Edit button opening its editor, or its editor while
    // it's open, or its save is under way or failed. Left out while it has no value, unless it can
    // be edited, which shows "Not set".
    const definedRow = (
        definition: PropertyDefinition,
        labelId: string,
        values: Readonly<Record<string, unknown>>,
    ): ReactNode => {
        if (!single || !entry) {
            return null;
        }

        const key = definition.field;
        const value = readValue(definition, values, entry);
        const editable = canEdit && !!definition.editable;

        if (!editable && isEmptyValue(value)) {
            return null;
        }

        const save = editable ? cache.save(single.entry, single.adapter, key) : undefined;
        const saving = save?.status === "saving";
        const failed = save?.status === "error" ? save : undefined;
        // A yes or no shown as the built-in one saves as it's toggled, with no editor to open.
        const toggles = editable && definition.type === "boolean" && !definition.render && !definition.renderEdit;
        const editor = editable && !toggles && hasEditor(definition);
        const opened = editing?.fieldId === key;
        const formattedValue = formatValue(definition, value, entry, locale);

        // A save from its own `render` shows under it rather than opening the editor.
        if (editor && (opened || (save && !definition.render))) {
            return (
                <Row key={key} label={definition.label} labelId={labelId}>
                    <PropertyEditor
                        key={single.entry.id}
                        definition={definition}
                        value={value}
                        entry={entry}
                        adapter={single.adapter}
                        save={save}
                        labelId={labelId}
                        takeFocus={opened}
                        onSave={(next) => saveValue(key, definition.label, next, true)}
                        onCancel={() => cancelEdit(key)}
                    />
                </Row>
            );
        }

        let shown: ReactNode;

        if (definition.render) {
            shown = (
                // Keyed by the entry, so what it holds of its own is that entry's, not the next one's.
                <Box key={single.entry.id} sx={customSx}>
                    {definition.render({
                        definition,
                        value,
                        formattedValue,
                        entry,
                        adapter: single.adapter,
                        labelId,
                        errors: NO_ERRORS,
                        save: editable ? (next: unknown) => saveValue(key, definition.label, next, false) : undefined,
                        saving,
                    })}
                </Box>
            );
        } else if (toggles) {
            shown = (
                <Checkbox
                    size="small"
                    checked={save?.status === "saving" ? save.value === true : value === true}
                    disabled={saving}
                    slotProps={{ input: { "aria-labelledby": labelId } }}
                    sx={toggleSx}
                    onChange={(event) => saveValue(key, definition.label, event.target.checked, false)}
                />
            );
        } else if (isEmptyValue(value)) {
            shown = (
                <Box component="span" sx={notSetSx}>
                    {text.propertiesNotSet}
                </Box>
            );
        } else {
            shown = <PropertyDisplay definition={definition} value={value} formattedValue={formattedValue} />;
        }

        return (
            <Row key={key} label={definition.label} labelId={labelId}>
                {shown}
                {definition.copyable && formattedValue && (
                    <CopyButton label={definition.label} value={formattedValue} onCopy={copy} />
                )}
                {editor && (
                    <TooltipIconButton
                        ref={editRefFor(key)}
                        label={text.propertiesEdit(definition.label)}
                        size="small"
                        onClick={() => setEditing({ entryId: single.entry.id, fieldId: key })}
                    >
                        <Icon name="edit" fontSize="small" />
                    </TooltipIconButton>
                )}
                {failed && (definition.render || toggles) && (
                    <Box role="alert" sx={saveErrorSx}>
                        <bdi>{messageOf(failed.error) ?? text.propertiesSaveFailed(definition.label)}</bdi>
                    </Box>
                )}
            </Row>
        );
    };

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
        // Entries in a trash are where they were moved there from, which they go back to.
        const trashed = items.every((item) => !!item.trashed);
        const locations = items.map((item) => (trashed ? item.trashed?.location : item.location));
        const [firstLocation] = locations;
        const location = locations.every((each) => each === firstLocation)
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
                <Row key="location" label={trashed ? text.propertiesOriginalLocation : text.propertiesLocation}>
                    {location}
                </Row>,
            );
        }

        if (single?.trashed?.trashedAt) {
            rows.push(
                <Row key="trashed" label={text.propertiesTrashed}>
                    <bdi>{formatDate(single.trashed.trashedAt)}</bdi>
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
        } else if (definitions && single && entry) {
            backendGroups = definitions.map((group, groupIndex) => {
                const rows = group.properties.flatMap((definition, index) => {
                    // Ids made from the indexes, as the app's keys may hold spaces, which an id can't.
                    const row = definedRow(definition, `${fieldId}-${groupIndex}-${index}`, handed?.values ?? NO_VALUES);

                    return row ? [row] : [];
                });

                return (
                    rows.length > 0 && (
                        <Box key={group.id} sx={groupSx}>
                            {group.title && (
                                <Typography component="h3" sx={groupTitleSx}>
                                    {group.title}
                                </Typography>
                            )}
                            <Box component="dl" sx={fieldsSx}>
                                {rows}
                            </Box>
                        </Box>
                    )
                );
            });
        } else if (handed) {
            backendGroups = handed.groups?.map((group, groupIndex) => (
                <Box key={group.id} sx={groupSx}>
                    {group.title && (
                        <Typography component="h3" sx={groupTitleSx}>
                            {group.title}
                        </Typography>
                    )}
                    <Box component="dl" sx={fieldsSx}>
                        {group.fields.map((field, index) => {
                            const editable = single && canEdit && isEditable(field) ? field : undefined;
                            const save = single && editable && cache.save(single.entry, single.adapter, field.id);
                            const opened = editing?.fieldId === field.id;
                            // Ids the consumer gives may hold spaces, which an id can't.
                            const labelId = editable && `${fieldId}-${groupIndex}-${index}`;

                            return (
                                <Row key={field.id} label={field.label} labelId={labelId}>
                                    {single && entry && editable && labelId && (save || opened) ? (
                                        <PropertyEditor
                                            key={single.entry.id}
                                            definition={definitionOf(editable)}
                                            value={editable.value}
                                            entry={entry}
                                            adapter={single.adapter}
                                            save={save}
                                            labelId={labelId}
                                            takeFocus={opened}
                                            onSave={(value) => saveValue(field.id, field.label, value, true)}
                                            onCancel={() => cancelEdit(field.id)}
                                        />
                                    ) : (
                                        <FieldValue
                                            field={field}
                                            onCopy={copy}
                                            onEdit={
                                                single && editable
                                                    ? () => setEditing({ entryId: single.entry.id, fieldId: field.id })
                                                    : undefined
                                            }
                                            editRef={editable && editRefFor(field.id)}
                                        />
                                    )}
                                </Row>
                            );
                        })}
                    </Box>
                </Box>
            ));
        }

        body = (
            <>
                {(!embedded || single?.rename || single?.openLocation || single?.openOrigin) && (
                    <Box sx={heroSx}>
                        {!embedded &&
                            (single ? (
                                <Picture item={single} size={pictureSize} />
                            ) : (
                                <Icon name="copy" color="action" sx={severalSx} />
                            ))}
                        {!embedded && (
                            <Typography component="p" sx={nameSx}>
                                {entry ? <bdi>{entry.name}</bdi> : text.propertiesItems(items.length)}
                            </Typography>
                        )}
                        {(single?.rename || single?.openLocation || single?.openOrigin) && (
                            <Box sx={buttonsSx}>
                                {single.openLocation && (
                                    <Button size="small" color="inherit" variant="outlined" onClick={single.openLocation}>
                                        {text.propertiesOpenLocation}
                                    </Button>
                                )}
                                {single.openOrigin && (
                                    <Button size="small" color="inherit" variant="outlined" onClick={single.openOrigin}>
                                        {text.propertiesOpenOriginalLocation}
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
                )}
                {ownRows && (
                    <Box sx={groupSx}>
                        <Box component="dl" sx={fieldsSx}>
                            {rows}
                        </Box>
                    </Box>
                )}
                {backendGroups}
            </>
        );
    }

    return (
        <Box
            component="aside"
            ref={rootRef}
            tabIndex={-1}
            aria-labelledby={embedded ? undefined : titleId}
            aria-label={embedded ? text.properties : undefined}
            sx={embedded ? embeddedSx : rootSx}
        >
            {!embedded && (
                <Box sx={headerSx}>
                    <Typography id={titleId} component="h2" noWrap sx={titleSx}>
                        {text.properties}
                    </Typography>
                    <ToolbarActions groups={actions} moreLabel={text.propertiesMoreActions} inline={INLINE_ACTIONS} />
                    {onClose && (
                        <TooltipIconButton label={text.propertiesClose} onClick={onClose}>
                            <Icon name="close" fontSize="small" />
                        </TooltipIconButton>
                    )}
                </Box>
            )}
            <Box ref={bodyRef} sx={bodySx}>
                {body}
            </Box>
            <Box role="status" sx={visuallyHiddenSx}>
                {said && <span key={said.id}>{said.message}</span>}
            </Box>
        </Box>
    );
};

export default PropertiesPanel;
