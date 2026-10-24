import { enUS } from "../locales/en-us";
import { isolate } from "./bidi";

import type { FileEntry, FileManagerLocaleText, Locale } from "../types";

// Decimal units, as GNOME Files shows them, above bytes.
const SIZE_UNITS = ["kilobyte", "megabyte", "gigabyte", "terabyte"];

// Accents and other combining marks, left out of what's searched for.
const MARKS = /\p{M}/gu;

const MIME_LABELS: [prefix: string, label: (text: FileManagerLocaleText) => string][] = [
    ["image/", (text) => text.typeImage],
    ["video/", (text) => text.typeVideo],
    ["audio/", (text) => text.typeAudio],
    ["text/", (text) => text.typeText],
    ["application/pdf", () => "PDF"],
    ["application/json", () => "JSON"],
    ["application/zip", (text) => text.typeArchive],
];

/**
 * The text and formats for a `FileManager`: `localeText` over the English defaults, with keys
 * given as undefined kept in English, and numbers, sizes, dates and the order of names in
 * `locale`, a BCP 47 tag, or the browser's language when it's undefined. Sizes and their units come
 * from `Intl` too, so they need no text.
 */
export const createLocale = (
    localeText: Partial<FileManagerLocaleText> | undefined,
    locale: string | undefined,
): Locale => {
    const given = localeText && Object.entries(localeText).filter(([, value]) => value !== undefined);
    const text: FileManagerLocaleText = given
        ? { ...enUS, ...(Object.fromEntries(given) as Partial<FileManagerLocaleText>) }
        : enUS;

    const numberFormat = new Intl.NumberFormat(locale, { useGrouping: false });
    const percentFormat = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    const byteFormat = new Intl.NumberFormat(locale, { style: "unit", unit: "byte", unitDisplay: "long" });
    const unitFormats = SIZE_UNITS.map(
        (unit) => new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 }),
    );
    const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
    const nameCollator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    const letterCollator = new Intl.Collator(locale, { sensitivity: "base" });
    const listFormat = new Intl.ListFormat(locale, { type: "conjunction" });

    const formatSize = (bytes: number) => {
        if (bytes < 1000) {
            return byteFormat.format(bytes);
        }

        let value = bytes / 1000;
        let unit = 0;

        while (value >= 1000 && unit < unitFormats.length - 1) {
            value /= 1000;
            unit += 1;
        }

        return unitFormats[unit].format(value);
    };

    const describeSize = (entry: FileEntry) => {
        if (entry.kind === "folder") {
            return entry.childCount === undefined ? "—" : text.itemCount(entry.childCount);
        }

        return entry.size === undefined ? "—" : formatSize(entry.size);
    };

    const describeType = (entry: FileEntry) => {
        if (entry.kind === "folder") {
            return text.typeFolder;
        }

        const mimeType = entry.mimeType;
        const match = mimeType ? MIME_LABELS.find(([prefix]) => mimeType.startsWith(prefix)) : undefined;

        if (match) {
            return match[1](text);
        }

        const dot = entry.name.lastIndexOf(".");

        return dot > 0 ? entry.name.slice(dot + 1).toUpperCase() : text.typeFile;
    };

    // The type labels the list shows, for a section's `acceptUploads` patterns: an extension as
    // `describeType` gives it, a MIME type or wildcard by its label, or as written when it has none.
    const describeAccepted = (patterns: readonly string[]) => {
        const labels = patterns.map((pattern) => {
            if (pattern.startsWith(".")) {
                return pattern.slice(1).toUpperCase();
            }

            const match = MIME_LABELS.find(([prefix]) => pattern.startsWith(prefix));

            return match ? match[1](text) : pattern;
        });

        return listFormat.format([...new Set(labels)].map(isolate));
    };

    return {
        text,
        formatNumber: (value) => numberFormat.format(value),
        formatPercent: (value) => percentFormat.format(value),
        formatSize,
        describeSize,
        describeDate: (entry) => (entry.modifiedAt ? dateFormat.format(entry.modifiedAt) : "—"),
        describeType,
        describeAccepted,
        compareNames: (a, b) => nameCollator.compare(a, b),
        sameLetters: (a, b) => letterCollator.compare(a, b) === 0,
        // Lowercased the locale's way (a Turkish "I" is "ı"), then split into letters and marks,
        // compatibility forms such as full-width letters and ligatures included, with the marks
        // dropped. Collation can't find text within text, so unlike `sameLetters` this leaves out
        // the accents of every language, as GNOME Files' search does.
        foldLetters: (value) => value.toLocaleLowerCase(locale).normalize("NFKD").replace(MARKS, ""),
    };
};

/** English, in the browser's language, for parts shown outside a `FileManager`. */
export const DEFAULT_LOCALE = createLocale(undefined, undefined);
