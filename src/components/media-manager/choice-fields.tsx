import { useId } from "react";
import type { KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { fieldMessages } from "../../utils/field-errors";
import { formatValue, hasBuiltInEditor, isEmptyValue, readValue } from "../../utils/property-value";
import PropertyDisplay from "../properties/property-display";
import PropertyInput from "../properties/property-input";

import type { FieldErrors, FileAdapter, FileEntry, PropertyDefinition, PropertyDefinitionGroup } from "../../types";

interface ChoiceFieldsProps {
    groups: readonly PropertyDefinitionGroup[];
    /** What the pick holds, by the fields' keys. */
    values: Readonly<Record<string, unknown>>;
    /** The asset picked, and the adapter of its library, for the app's own fields. */
    asset: FileEntry;
    adapter: FileAdapter;
    /** The media manager's `errors`, as the app passed them, each field finding its own by its `errorKey`. */
    errors: FieldErrors;
    /**
     * The pick's place in the order the app was handed the picks in, which the fields' keys in
     * `errors` are made from.
     */
    index: number;
    /** The pick's own messages, about it as a whole, which `choiceErrorKey` finds, shown above its fields. */
    messages: readonly string[];
    onChange: (key: string, value: unknown) => void;
}

interface FieldProps {
    definition: PropertyDefinition;
    value: unknown;
    asset: FileEntry;
    adapter: FileAdapter;
    /** The control's id, which its label is for. */
    id: string;
    labelId: string;
    errors: FieldErrors;
    index: number;
    /** The id of its messages, while its `errorKey` finds an error. */
    errorId: string | undefined;
    onChange: (value: unknown) => void;
}

interface LabelProps {
    definition: PropertyDefinition;
    labelId: string;
    /** The control it's for, when it's one of the media manager's. */
    htmlFor?: string;
    /** Whether its `errorKey` finds an error, which colours it. */
    error: boolean;
}

// The pick's own errors, above its fields, each message on a line of its own, marked by a rule at
// their start side, which forced colors keep.
const ownMessagesSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
    mb: 2,
    paddingInlineStart: 1.25,
    borderInlineStart: "3px solid",
    color: "error.main",
    fontSize: "0.8125rem",
    overflowWrap: "anywhere",
};

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

const Label = ({ definition, labelId, htmlFor, error }: LabelProps) => {
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

    const sx = error ? errorLabelSx : labelSx;

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
 * One of the app's fields for a pick, as it's to be filled in: its own editor (`renderEdit`), the
 * built-in one of its type, or its `render` changing it in place through `save`. One that isn't
 * `editable` only shows what it holds, left out while it's empty and has no error. With an error its
 * `errorKey` finds, its label and control are marked, and its messages, under it, describe it.
 */
const Field = ({ definition, value, asset, adapter, id, labelId, errors, index, errorId, onChange }: FieldProps) => {
    const locale = useLocale();
    const formattedValue = formatValue(definition, value, asset, locale);
    const error = errorId !== undefined;
    const base = { definition, value, formattedValue, entry: asset, adapter, labelId, errors, index, errorId };

    if (definition.editable === false) {
        return (
            <>
                <Label definition={definition} labelId={labelId} error={error} />
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
                <Label definition={definition} labelId={labelId} error={error} />
                <Box sx={ownSx}>
                    {definition.renderEdit({
                        ...base,
                        id,
                        onChange: (next) => onChange(next),
                        disabled: false,
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
                    error={error}
                    describedBy={errorId}
                />
                <Typography
                    component="label"
                    htmlFor={id}
                    id={labelId}
                    variant="body2"
                    color={error ? "error" : undefined}
                >
                    {definition.label}
                </Typography>
            </Box>
        );
    }

    if (hasBuiltInEditor(definition)) {
        return (
            <>
                <Label definition={definition} labelId={labelId} htmlFor={id} error={error} />
                <PropertyInput
                    definition={definition}
                    value={value}
                    onChange={onChange}
                    id={id}
                    labelId={labelId}
                    error={error}
                    describedBy={errorId}
                />
            </>
        );
    }

    // Its `render` sets the pick's value as it saves, at once.
    return (
        <>
            <Label definition={definition} labelId={labelId} error={error} />
            {definition.render && (
                <Box sx={ownSx}>
                    {definition.render({
                        ...base,
                        save: (next: unknown) => {
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
 * The app's fields for one pick, by groups, each drawn as its definition says, with what the pick
 * holds under its key, and each change handed back by that key, under the pick's own errors. The
 * fields and their labels are the app's; the media manager knows nothing of what they mean, nor of
 * the languages they're in.
 */
const ChoiceFields = ({
    groups,
    values,
    asset,
    adapter,
    errors,
    index: pickIndex,
    messages: ownMessages,
    onChange,
}: ChoiceFieldsProps) => {
    // Ids made from the indexes, as the app's keys may hold spaces, which an id can't.
    const baseId = useId();

    return (
        <>
            {ownMessages.length > 0 && (
                <Box sx={ownMessagesSx}>
                    {ownMessages.map((message, place) => (
                        <bdi key={place}>{message}</bdi>
                    ))}
                </Box>
            )}
            <Box sx={groupsSx} onKeyDown={keepEnter}>
                {groups.map((group, groupIndex) => {
                    const fields = group.properties.flatMap((definition, index) => {
                        const value = readValue(definition, values, asset);

                        const messages = fieldMessages(definition, errors, pickIndex, asset);
                        const errorId = messages.length > 0 ? `${baseId}-${groupIndex}-${index}-error` : undefined;

                        if (definition.editable === false && isEmptyValue(value) && !errorId) {
                            return [];
                        }

                        return [
                            <Box key={definition.field} sx={fieldSx}>
                                <Field
                                    definition={definition}
                                    value={value}
                                    asset={asset}
                                    adapter={adapter}
                                    id={`${baseId}-${groupIndex}-${index}`}
                                    labelId={`${baseId}-${groupIndex}-${index}-label`}
                                    errors={errors}
                                    index={pickIndex}
                                    errorId={errorId}
                                    onChange={(next) => onChange(definition.field, next)}
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
        </>
    );
};

export default ChoiceFields;
