import { useId, useLayoutEffect, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { NO_ERRORS, NO_MESSAGES, fieldMessages } from "../../utils/field-errors";
import { uploadStandIn } from "../../utils/media";
import { formatValue, hasBuiltInEditor, isEmptyValue, readValue } from "../../utils/property-value";
import PropertyDisplay from "../properties/property-display";
import PropertyInput from "../properties/property-input";

import type { FieldErrors, FileAdapter, FileEntry, PropertyDefinition, PropertyDefinitionGroup } from "../../types";

export interface MediaFieldsProps<V = Record<string, unknown>> {
    /** What to draw, made fresh from `values` each time if it likes, as it's only read to be drawn. */
    groups: readonly PropertyDefinitionGroup[];
    /** What the form holds, each field's value under its `field`. */
    values: V;
    /** Takes all of what the form holds once a field has changed, for the form to keep or change further. */
    setValues: (next: V) => void;
    /** The library's adapter, handed to the fields' own `render` and `renderEdit`. */
    adapter: FileAdapter;
    /** The asset they're for; in an upload form there's none yet, but `files`. */
    asset?: FileEntry;
    /** The files about to be uploaded, in an upload form. */
    files?: readonly File[];
    /** The form's `errors`, each field finding its own by its `errorKey`. */
    errors?: FieldErrors;
    /** The place the fields' keys in `errors` are made from. Without it, no field shows its errors. */
    index?: number;
    /** Whether the form's being sent, while no field can be changed. */
    sending?: boolean;
}

const NO_FILES: readonly File[] = [];

interface FieldProps {
    definition: PropertyDefinition;
    value: unknown;
    asset: FileEntry;
    adapter: FileAdapter;
    /** The control's id, which its label is for. */
    id: string;
    labelId: string;
    errors: FieldErrors;
    index: number | undefined;
    /** The id of its messages, while its `errorKey` finds an error. */
    errorId: string | undefined;
    files: readonly File[] | undefined;
    /** Whether the form's being sent, while it can't be changed. */
    sending: boolean;
    onChange: (value: unknown) => void;
}

interface LabelProps {
    definition: PropertyDefinition;
    labelId: string;
    /** The control it's for, when it's one of the media manager's. */
    htmlFor?: string;
    /** Whether its `errorKey` finds an error, which colours it. */
    error: boolean;
    /** Whether it's `disabled`, which greys it. */
    disabled: boolean;
}

// The groups in a box of their own, so the first of them is its first child, whatever the pick's
// details put above it.
const groupsSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
};

// Each group is set apart by a rule above it, as the properties' groups are, the first by the
// rule under the pick's own heading above it.
const groupSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    py: 2,
    borderTop: 1,
    borderColor: "divider",
    "&:first-child": { borderTop: 0, pt: 0 },
};

const groupTitleSx: SxProps<Theme> = {
    fontSize: "0.8125rem",
    fontWeight: 600,
};

const fieldSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 0.75,
    minWidth: 0,
    "& > .MuiFormControl-fullWidth": { alignSelf: "stretch" },
};

// Above the field rather than floating in it, whose placement is physical (see `rtl.md`).
const labelSx: SxProps<Theme> = {
    width: "fit-content",
    color: "text.secondary",
    fontSize: "0.75rem",
};

const errorLabelSx: SxProps<Theme> = {
    ...labelSx,
    color: "error.main",
};

const disabledLabelSx: SxProps<Theme> = {
    ...labelSx,
    color: "text.disabled",
};

const requiredSx: SxProps<Theme> = {
    color: "error.main",
};

// Under the field, as a helper text is, each message on a line of its own.
const messagesSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.25,
    color: "error.main",
    fontSize: "0.75rem",
    overflowWrap: "anywhere",
};

// The checkbox's own padding lines its box up with the labels above the other fields.
const checkRowSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.25,
};

// The app's own control takes the field's whole width.
const ownSx: SxProps<Theme> = {
    alignSelf: "stretch",
    minWidth: 0,
};

const valueSx: SxProps<Theme> = {
    fontSize: "0.875rem",
    overflowWrap: "anywhere",
};

/** Enter in a field on one line goes no further, so it doesn't submit a form the app has around it. */
const keepEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.defaultPrevented && event.target instanceof HTMLInputElement) {
        event.preventDefault();
    }
};

const Label = ({ definition, labelId, htmlFor, error, disabled }: LabelProps) => {
    const content = (
        <>
            {definition.label}
            {definition.required && (
                <Box component="span" aria-hidden sx={requiredSx}>
                    {" *"}
                </Box>
            )}
        </>
    );

    const sx = error ? errorLabelSx : disabled ? disabledLabelSx : labelSx;

    return htmlFor ? (
        <Typography component="label" htmlFor={htmlFor} id={labelId} sx={sx}>
            {content}
        </Typography>
    ) : (
        <Typography id={labelId} sx={sx}>
            {content}
        </Typography>
    );
};

/**
 * One of the app's fields, as it's to be filled in: its own editor (`renderEdit`), the built-in one
 * of its type, or its `render` changing it in place through `save`. One that isn't `editable` only
 * shows what it holds, left out while it's empty and has no error. One `disabled` shows, greyed, and
 * can't be changed, and neither can any while the form's being sent, a text field keeping the focus.
 * With an error its `errorKey` finds, its label and control are marked, and its
 * messages, under it, describe it.
 */
const Field = ({
    definition,
    value,
    asset,
    adapter,
    id,
    labelId,
    errors,
    index,
    errorId,
    files,
    sending,
    onChange,
}: FieldProps) => {
    const locale = useLocale();
    const formattedValue = formatValue(definition, value, asset, locale);
    const error = errorId !== undefined;
    const off = !!definition.disabled;
    const disabled = off || sending;
    const base = { definition, value, formattedValue, entry: asset, adapter, labelId, errors, index, errorId, files };

    if (definition.editable === false) {
        return (
            <>
                <Label definition={definition} labelId={labelId} error={error} disabled={off} />
                {definition.render ? (
                    <Box sx={ownSx}>{definition.render({ ...base, saving: false, error })}</Box>
                ) : (
                    <Box sx={valueSx}>
                        <PropertyDisplay definition={definition} value={value} formattedValue={formattedValue} />
                    </Box>
                )}
            </>
        );
    }

    if (definition.renderEdit) {
        return (
            <>
                <Label definition={definition} labelId={labelId} error={error} disabled={off} />
                <Box sx={ownSx}>
                    {definition.renderEdit({
                        ...base,
                        id,
                        onChange: (next) => onChange(next),
                        disabled,
                        error,
                    })}
                </Box>
            </>
        );
    }

    if (definition.type === "boolean") {
        return (
            <Box sx={checkRowSx}>
                <PropertyInput
                    definition={definition}
                    value={value}
                    onChange={onChange}
                    id={id}
                    labelId={labelId}
                    disabled={disabled}
                    off={off}
                    error={error}
                    describedBy={errorId}
                />
                <Typography
                    component="label"
                    htmlFor={id}
                    id={labelId}
                    variant="body2"
                    color={error ? "error" : off ? "text.disabled" : undefined}
                >
                    {definition.label}
                </Typography>
            </Box>
        );
    }

    if (hasBuiltInEditor(definition)) {
        return (
            <>
                <Label definition={definition} labelId={labelId} htmlFor={id} error={error} disabled={off} />
                <PropertyInput
                    definition={definition}
                    value={value}
                    onChange={onChange}
                    id={id}
                    labelId={labelId}
                    disabled={disabled}
                    off={off}
                    error={error}
                    describedBy={errorId}
                />
            </>
        );
    }

    // Its `render` sets its value as it saves, at once.
    return (
        <>
            <Label definition={definition} labelId={labelId} error={error} disabled={off} />
            {definition.render && (
                <Box sx={ownSx}>
                    {definition.render({
                        ...base,
                        save: disabled
                            ? undefined
                            : (next: unknown) => {
                                  onChange(next);

                                  return Promise.resolve(true);
                              },
                        saving: false,
                        error,
                    })}
                </Box>
            )}
        </>
    );
};

/**
 * Fields from their definitions, by groups, for a form of the app's to draw all or part of itself
 * with: each drawn as its definition says, with what's held under its `field`, and each change handed
 * back with the rest, as they are by then, so a field answering late doesn't undo what's changed
 * meanwhile. They're made fresh as the form likes, from what it holds, so a field can
 * follow another: gone, or `disabled`, as it's unticked. The labels are the app's; the media manager
 * knows nothing of what they mean, nor of the languages they're in. `{...form}` hands it all it needs.
 */
const MediaFields = <V,>({
    groups,
    values,
    setValues,
    adapter,
    asset,
    files = NO_FILES,
    errors = NO_ERRORS,
    index: pickIndex,
    sending = false,
}: MediaFieldsProps<V>) => {
    // Ids made from the indexes, as the app's keys may hold spaces, which an id can't.
    const baseId = useId();
    const held = values as Readonly<Record<string, unknown>>;
    const entry = useMemo(() => asset ?? uploadStandIn(files), [asset, files]);
    // What it holds by now, for a field changing later than it was drawn, or two at once.
    const latestRef = useRef(held);

    useLayoutEffect(() => {
        latestRef.current = held;
    });

    return (
        <Box sx={groupsSx} onKeyDown={keepEnter}>
            {groups.map((group, groupIndex) => {
                const fields = group.properties.flatMap((definition, index) => {
                    const value = readValue(definition, held, entry);

                    const messages =
                        pickIndex === undefined ? NO_MESSAGES : fieldMessages(definition, errors, pickIndex, entry);
                    const errorId = messages.length > 0 ? `${baseId}-${groupIndex}-${index}-error` : undefined;

                    if (definition.editable === false && isEmptyValue(value) && !errorId) {
                        return [];
                    }

                    return [
                        <Box key={definition.field} sx={fieldSx}>
                            <Field
                                definition={definition}
                                value={value}
                                asset={entry}
                                adapter={adapter}
                                id={`${baseId}-${groupIndex}-${index}`}
                                labelId={`${baseId}-${groupIndex}-${index}-label`}
                                errors={errors}
                                index={pickIndex}
                                errorId={errorId}
                                files={asset ? undefined : files}
                                sending={sending}
                                onChange={(next) => {
                                    const merged = { ...latestRef.current, [definition.field]: next };

                                    latestRef.current = merged;
                                    setValues(merged as V);
                                }}
                            />
                            {errorId && (
                                <Box id={errorId} sx={messagesSx}>
                                    {messages.map((message, place) => (
                                        <bdi key={place}>{message}</bdi>
                                    ))}
                                </Box>
                            )}
                        </Box>,
                    ];
                });

                return (
                    fields.length > 0 && (
                        <Box
                            key={group.id}
                            role="group"
                            aria-labelledby={group.title ? `${baseId}-${groupIndex}` : undefined}
                            sx={groupSx}
                        >
                            {group.title && (
                                <Typography id={`${baseId}-${groupIndex}`} component="h3" sx={groupTitleSx}>
                                    {group.title}
                                </Typography>
                            )}
                            {fields}
                        </Box>
                    )
                );
            })}
        </Box>
    );
};

export default MediaFields;
