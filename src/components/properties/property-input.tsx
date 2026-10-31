import { useImperativeHandle, useState } from "react";
import type { KeyboardEvent, MouseEvent, Ref } from "react";

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import { dateFromInput, dateInputValue, formatItem, optionsOf } from "../../utils/property-value";

import type { PropertyDefinition, PropertyOption } from "../../types";

/** What an editor asks of its input as it saves: the value, with anything typed but not added yet. */
export interface PropertyInputHandle {
    flush: () => unknown;
}

interface PropertyInputProps {
    definition: PropertyDefinition;
    value: unknown;
    onChange: (value: unknown) => void;
    /** The control's id, which a label may be for. */
    id: string;
    /** The element naming it, its label. */
    labelId: string;
    /** While it's saved: shown, but not changed. */
    disabled?: boolean;
    /** Its save failed. */
    error?: boolean;
    /** Given what an editor needs to save a list with something typed but not added yet. */
    handle?: Ref<PropertyInputHandle>;
}

type Typed<T extends PropertyDefinition["type"]> = Extract<PropertyDefinition, { type: T }>;

interface InputProps<D extends PropertyDefinition = PropertyDefinition> extends Omit<PropertyInputProps, "definition"> {
    definition: D;
}

interface OptionsProps extends InputProps {
    options: readonly PropertyOption<unknown>[];
}

const tagsSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    gap: 0.5,
    "&:empty": { display: "none" },
};

// A small chip's delete icon is spaced with a physical `margin-left` and `margin-right`, reset for
// logical ones (see `rtl.md`).
const chipSx: SxProps<Theme> = {
    "& .MuiChip-deleteIcon": { marginLeft: 0, marginRight: 0, marginInlineStart: "-4px", marginInlineEnd: "4px" },
};

// A native select keeps room for its arrow with a physical `padding-right`, and places the arrow
// with `right`, reset for logical ones (see `rtl.md`). MUI's rule for the padding is a triple class.
const selectSx: SxProps<Theme> = {
    "& .MuiNativeSelect-select.MuiNativeSelect-select.MuiNativeSelect-select.MuiInputBase-input": {
        paddingRight: "14px",
        paddingInlineEnd: "32px",
    },
    "& .MuiNativeSelect-icon": { right: "auto", insetInlineEnd: "7px" },
};

// The checkbox's own padding, kept small, so it sits in the row as a value does.
const checkboxSx: SxProps<Theme> = {
    p: 0.5,
    marginInlineStart: "-4px",
};

// A press on a chip leaves the focus in the field it belongs to, so an editor doesn't take it as
// the focus leaving, which saves; Safari doesn't focus what's pressed.
const keepFocus = (event: MouseEvent) => event.preventDefault();

const unique = (values: readonly unknown[]) => [...new Set(values)];

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Text, on one line or several, or a URL. */
const TextInput = ({ definition, value, onChange, id, labelId, disabled, error }: InputProps<Typed<"string">>) => {
    const url = definition.kind === "url";
    const multiline = !!definition.multiline && !url;

    return (
        <TextField
            id={id}
            fullWidth
            size="small"
            type={url ? "url" : undefined}
            multiline={multiline}
            minRows={multiline ? 2 : undefined}
            maxRows={multiline ? 8 : undefined}
            value={typeof value === "string" ? value : ""}
            placeholder={definition.placeholder}
            error={error}
            slotProps={{
                htmlInput: {
                    "aria-labelledby": labelId,
                    "aria-required": definition.required || undefined,
                    maxLength: definition.maxLength,
                    lang: definition.lang,
                    // A URL runs left to right in any language.
                    dir: url ? "ltr" : (definition.dir ?? "auto"),
                    readOnly: disabled,
                },
            }}
            onChange={(event) => onChange(event.target.value)}
        />
    );
};

/** A number, typed as text meanwhile, so "1." on its way to "1.5" isn't cut short. */
const NumberInput = ({ definition, value, onChange, id, labelId, disabled, error }: InputProps<Typed<"number">>) => {
    const given = isNumber(value) ? value : undefined;
    const [draft, setDraft] = useState(given === undefined ? "" : String(given));
    const [seen, setSeen] = useState(given);

    // A value set from outside shows, unless it's what's typed already.
    if (seen !== given) {
        setSeen(given);

        if (draft === "" || Number(draft) !== given) {
            setDraft(given === undefined ? "" : String(given));
        }
    }

    return (
        <TextField
            id={id}
            size="small"
            type="number"
            value={draft}
            error={error}
            slotProps={{
                htmlInput: {
                    "aria-labelledby": labelId,
                    "aria-required": definition.required || undefined,
                    min: definition.min,
                    max: definition.max,
                    step: definition.step,
                    readOnly: disabled,
                },
            }}
            onChange={(event) => {
                const typed = event.target.value;
                const number = Number(typed);

                setDraft(typed);

                if (typed === "") {
                    onChange(undefined);
                } else if (Number.isFinite(number)) {
                    onChange(number);
                }
            }}
        />
    );
};

/** A day, or with the "datetime" kind a day and a time, in the browser's own picker. */
const DateInput = ({ definition, value, onChange, id, labelId, disabled, error }: InputProps<Typed<"date">>) => {
    const time = definition.kind === "datetime";

    return (
        <TextField
            id={id}
            size="small"
            type={time ? "datetime-local" : "date"}
            value={dateInputValue(value, time)}
            error={error}
            slotProps={{
                htmlInput: {
                    "aria-labelledby": labelId,
                    "aria-required": definition.required || undefined,
                    readOnly: disabled,
                },
            }}
            onChange={(event) => onChange(dateFromInput(event.target.value, time))}
        />
    );
};

const BooleanInput = ({ value, onChange, id, labelId, disabled }: InputProps) => (
    <Checkbox
        id={id}
        size="small"
        checked={value === true}
        disabled={disabled}
        slotProps={{ input: { "aria-labelledby": labelId } }}
        sx={checkboxSx}
        onChange={(event) => onChange(event.target.checked)}
    />
);

/**
 * One value chosen from the options, in the browser's own select, its first choice leaving it
 * empty. Options go by their place, as their values may not be text.
 */
const SelectInput = ({ definition, options, value, onChange, id, labelId, disabled, error }: OptionsProps) => {
    const { text } = useLocale();
    const index = options.findIndex((option) => Object.is(option.value, value));

    return (
        <TextField
            id={id}
            select
            size="small"
            fullWidth
            value={index === -1 ? "" : String(index)}
            disabled={disabled}
            error={error}
            slotProps={{
                select: { native: true },
                htmlInput: { "aria-labelledby": labelId, "aria-required": definition.required || undefined },
            }}
            sx={selectSx}
            onChange={(event) =>
                onChange(event.target.value === "" ? undefined : options[Number(event.target.value)]?.value)
            }
        >
            <option value="">{text.propertiesNone}</option>
            {options.map((option, place) => (
                <option key={place} value={String(place)}>
                    {option.label}
                </option>
            ))}
        </TextField>
    );
};

/**
 * Values chosen from the options: those chosen as chips, each removing itself, over a select adding
 * one of the rest.
 */
const ChoicesInput = ({ definition, options, value, onChange, id, labelId, disabled, error }: OptionsProps) => {
    const { text } = useLocale();
    const chosen = Array.isArray(value) ? (value as unknown[]) : [];
    const left = options.flatMap((option, place) =>
        chosen.some((each) => Object.is(each, option.value)) ? [] : [{ option, place }],
    );
    const prompt = (definition.type === "string" && definition.placeholder) || text.propertiesAddOption;

    const remove = (item: unknown) => onChange(chosen.filter((each) => !Object.is(each, item)));

    return (
        <>
            <Box sx={tagsSx}>
                {chosen.map((item) => {
                    const label = options.find((option) => Object.is(option.value, item))?.label ?? String(item);

                    return (
                        <Chip
                            key={String(item)}
                            size="small"
                            label={<bdi>{label}</bdi>}
                            aria-label={text.propertiesRemoveTag(isolate(label))}
                            disabled={disabled}
                            sx={chipSx}
                            onMouseDown={keepFocus}
                            onClick={() => remove(item)}
                            onDelete={() => remove(item)}
                        />
                    );
                })}
            </Box>
            {left.length > 0 && (
                <TextField
                    id={id}
                    select
                    size="small"
                    fullWidth
                    value=""
                    disabled={disabled}
                    error={error}
                    slotProps={{
                        select: { native: true },
                        htmlInput: { "aria-labelledby": labelId, "aria-required": definition.required || undefined },
                    }}
                    sx={selectSx}
                    onChange={(event) => {
                        const picked = options[Number(event.target.value)];

                        if (event.target.value !== "" && picked) {
                            onChange([...chosen, picked.value]);
                        }
                    }}
                >
                    <option value="">{prompt}</option>
                    {left.map(({ option, place }) => (
                        <option key={place} value={String(place)}>
                            {option.label}
                        </option>
                    ))}
                </TextField>
            )}
        </>
    );
};

/**
 * Values typed in, as tags are: chips, each removing itself, over a field adding what's typed with
 * Enter, a comma between texts, or the focus leaving; Backspace with nothing typed removes the
 * last. A date is added as it's picked.
 */
const ListInput = ({ definition, value, onChange, id, labelId, disabled, error, handle }: InputProps) => {
    const locale = useLocale();
    const { text } = locale;
    const [typed, setTyped] = useState("");
    const items = Array.isArray(value) ? (value as unknown[]) : [];
    const time = definition.type === "date" && definition.kind === "datetime";
    const prompt = (definition.type === "string" && definition.placeholder) || text.propertiesAddTag;
    const inputType =
        definition.type === "number" ? "number" : definition.type === "date" ? (time ? "datetime-local" : "date") : undefined;

    // What's typed, as the values it adds: texts split at commas, a number, or a date.
    const parse = (input: string): unknown[] => {
        switch (definition.type) {
            case "number": {
                const number = Number(input);

                return input.trim() !== "" && Number.isFinite(number) ? [number] : [];
            }
            case "date": {
                const date = dateFromInput(input, time);

                return date === undefined ? [] : [date];
            }
            default:
                return input
                    .split(",")
                    .map((each) => each.trim())
                    .filter(Boolean);
        }
    };

    const add = (input: string) => {
        const next = unique([...items, ...parse(input)]);

        setTyped("");

        if (next.length !== items.length) {
            onChange(next);
        }

        return next;
    };

    useImperativeHandle(handle, () => ({ flush: () => (typed.trim() ? add(typed) : items) }));

    const remove = (item: unknown) => onChange(items.filter((each) => !Object.is(each, item)));

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) {
            return;
        }

        if (
            (event.key === "Enter" && !event.ctrlKey && !event.metaKey && typed.trim()) ||
            (event.key === "," && definition.type === "string")
        ) {
            event.preventDefault();
            add(typed);
        } else if (event.key === "Backspace" && !typed && items.length > 0) {
            event.preventDefault();
            onChange(items.slice(0, -1));
        }
    };

    return (
        <>
            <Box sx={tagsSx}>
                {items.map((item) => {
                    const label = formatItem(definition, item, locale);

                    return (
                        <Chip
                            key={String(item)}
                            size="small"
                            label={<bdi>{label}</bdi>}
                            aria-label={text.propertiesRemoveTag(isolate(label))}
                            disabled={disabled}
                            sx={chipSx}
                            onMouseDown={keepFocus}
                            onClick={() => remove(item)}
                            onDelete={() => remove(item)}
                        />
                    );
                })}
            </Box>
            <TextField
                id={id}
                fullWidth
                size="small"
                type={inputType}
                placeholder={definition.type === "string" ? prompt : undefined}
                value={typed}
                error={error}
                slotProps={{
                    htmlInput: {
                        "aria-label": prompt,
                        "aria-describedby": labelId,
                        "aria-required": definition.required || undefined,
                        readOnly: disabled,
                        dir: "auto",
                    },
                }}
                onChange={(event) => {
                    if (definition.type === "date") {
                        add(event.target.value);
                    } else {
                        setTyped(event.target.value);
                    }
                }}
                onBlur={() => {
                    if (typed.trim()) {
                        add(typed);
                    }
                }}
                onKeyDown={handleKeyDown}
            />
        </>
    );
};

/**
 * The built-in control for a property of the app's definition, by its type: text, a URL, a number,
 * a date, a checkbox, a select from its options, chips chosen from them or typed in for a list. A
 * number of a kind that's only written out (size, duration), or a property with no type, has none.
 * Its label is the host's, which names it through `labelId`.
 */
const PropertyInput = (props: PropertyInputProps) => {
    const { definition } = props;

    if (definition.type === "boolean") {
        return <BooleanInput {...props} />;
    }

    if (definition.type !== "string" && definition.type !== "number" && definition.type !== "date") {
        return null;
    }

    const options = optionsOf(definition);

    if (options) {
        return definition.multiple ? (
            <ChoicesInput {...props} options={options} />
        ) : (
            <SelectInput {...props} options={options} />
        );
    }

    if (definition.multiple) {
        return <ListInput {...props} />;
    }

    switch (definition.type) {
        case "string":
            return <TextInput {...props} definition={definition} />;
        case "number":
            return definition.kind ? null : <NumberInput {...props} definition={definition} />;
        case "date":
            return <DateInput {...props} definition={definition} />;
    }
};

export default PropertyInput;
