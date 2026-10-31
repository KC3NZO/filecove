import type { FileEntry, Locale, PropertyDefinition, PropertyOption } from "../types";

// A day alone, which is that day where the user is, not midnight in London.
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

/** Whether a property has nothing to show: nothing, an empty text, or an empty list. */
export const isEmptyValue = (value: unknown) =>
    value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * A date from what a backend hands over: a `Date`, milliseconds, or an ISO string, a day alone
 * ("2026-10-31") taken as that day where the user is, as `new Date` would take it at midnight UTC
 * and show the day before west of London.
 */
export const toDate = (value: unknown): Date | undefined => {
    let date: Date | undefined;

    if (value instanceof Date) {
        date = value;
    } else if (typeof value === "number") {
        date = new Date(value);
    } else if (typeof value === "string") {
        const day = DAY.exec(value);

        date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
    }

    return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

/** A date as a date input takes it, where the user is: "2026-10-31", or with `time`, "2026-10-31T14:05". */
export const dateInputValue = (value: unknown, time: boolean) => {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return time ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
};

/**
 * What a date input gave, as it's saved: a day as it is ("2026-10-31"), and a time as the instant
 * it is, in ISO with its zone, as the input gives it where the user is.
 */
export const dateFromInput = (input: string, time: boolean): string | undefined => {
    if (!input) {
        return undefined;
    }

    if (!time) {
        return input;
    }

    // A date and time with no zone is read where the user is.
    const date = new Date(input);

    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** A property's value: what its `valueGetter` makes, or the raw one under its `field`. */
export const readValue = (
    definition: PropertyDefinition,
    values: Readonly<Record<string, unknown>>,
    entry: FileEntry,
): unknown => (definition.valueGetter ? definition.valueGetter(values[definition.field], entry) : values[definition.field]);

/** What a property is chosen from, when it is. */
export const optionsOf = (definition: PropertyDefinition): readonly PropertyOption<unknown>[] | undefined =>
    "options" in definition ? definition.options : undefined;

/** A value the media manager has no format for, when it's plain enough to show. */
const plainText = (value: unknown, { formatCount }: Locale) =>
    typeof value === "string" ? value : typeof value === "number" ? formatCount(value) : "";

/** One value of a property, written by its option's label, its kind, or its type. */
export const formatItem = (definition: PropertyDefinition, value: unknown, locale: Locale): string => {
    const option = optionsOf(definition)?.find((each) => Object.is(each.value, value));

    if (option) {
        return option.label;
    }

    switch (definition.type) {
        case "number":
            if (typeof value !== "number" || !Number.isFinite(value)) {
                return plainText(value, locale);
            }

            return definition.kind === "size"
                ? locale.formatSize(value)
                : definition.kind === "duration"
                  ? locale.formatDuration(value)
                  : locale.formatCount(value);
        case "boolean":
            return value === true
                ? locale.text.propertiesYes
                : value === false
                  ? locale.text.propertiesNo
                  : plainText(value, locale);
        case "date": {
            const date = toDate(value);

            if (!date) {
                return plainText(value, locale);
            }

            return definition.kind === "datetime" ? locale.formatDate(date) : locale.formatDay(date);
        }
        default:
            return plainText(value, locale);
    }
};

/**
 * A property's text, as Copy copies it and screen readers read it: its `valueFormatter`'s, or each
 * value written by its option, its kind or its type, a list's listed the locale's way. Empty while
 * it has none, which `valueFormatter` isn't asked about.
 */
export const formatValue = (definition: PropertyDefinition, value: unknown, entry: FileEntry, locale: Locale) => {
    if (isEmptyValue(value)) {
        return "";
    }

    if (definition.valueFormatter) {
        return definition.valueFormatter(value, entry);
    }

    if (Array.isArray(value)) {
        return locale.formatList(value.map((item) => formatItem(definition, item, locale)).filter(Boolean));
    }

    return formatItem(definition, value, locale);
};

/**
 * Whether the media manager has an editor of its own for a property: every type, but a number of a
 * kind it only writes out (size, duration) with nothing to choose from, and no type at all.
 */
export const hasBuiltInEditor = (definition: PropertyDefinition) => {
    switch (definition.type) {
        case "string":
        case "boolean":
        case "date":
            return true;
        case "number":
            return definition.kind === undefined || !!optionsOf(definition);
        default:
            return false;
    }
};

/** Whether a property can be edited at all: by its own editor, or by the built-in one. */
export const hasEditor = (definition: PropertyDefinition) => !!definition.renderEdit || hasBuiltInEditor(definition);

/** Whether two values are the same, lists item by item, an empty text the same as none. */
export const sameValue = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b) || (isEmptyValue(a) && isEmptyValue(b))) {
        return true;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
    }

    if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }

    return false;
};

/** The link a property of the "url" kind goes to, when it's one a page may open: the web's, mail or a phone. */
export const safeHref = (value: unknown) => {
    if (typeof value !== "string") {
        return undefined;
    }

    try {
        const url = new URL(value, window.location.href);

        return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
};
