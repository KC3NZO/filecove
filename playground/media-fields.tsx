import { useState } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaFields } from "../src";

import type {
    FileEntry,
    MediaForm,
    MediaKind,
    MediaPickFormParams,
    MediaSection,
    PropertyDefinition,
    PropertyDefinitionGroup,
    PropertyEditParams,
    PropertyErrorKeyParams,
    PropertyRenderParams,
} from "../src";

// The playground's own form for each pick (`pickForm`), as a site's carousel would have it:
// everything here is the app's, its languages too, a picture's texts as a field per language, a
// video's title as one field with a tab a language. Its fields are drawn by `MediaFields`, from
// definitions as what an asset shows is. The media manager keeps what's filled in with the pick, and
// hands it back with what's chosen. Each finds its errors in what the playground's backend answers
// (`mocks/mock-save.ts`) by its `errorKey`, the request's key for it, or its keys: the video's
// title names one a language, and reads `errors` itself only to mark the tab of each language with
// one.

/** The site's languages, which the media manager knows nothing of. */
export const LANGUAGES = [
    { code: "en", label: "English", dir: "ltr" },
    { code: "fr", label: "Français", dir: "ltr" },
    { code: "fa", label: "فارسی", dir: "rtl" },
] as const;

type Language = (typeof LANGUAGES)[number]["code"];

const POINTS = ["top-start", "top", "top-end", "start", "center", "end", "bottom-start", "bottom", "bottom-end"];

const pointsSx: SxProps<Theme> = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 2rem)",
    gap: 0.5,
};

const pointSx: SxProps<Theme> = {
    height: "2rem",
    borderRadius: 1,
    border: 1,
    borderColor: "divider",
    "&[aria-checked='true']": { bgcolor: "primary.main", borderColor: "primary.main" },
    "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main", outlineOffset: 1 },
    "[aria-invalid='true'] > &": { borderColor: "error.main" },
};

const languagesSx: SxProps<Theme> = {
    display: "flex",
    gap: 0.5,
    mb: 1,
};

const languageSx: SxProps<Theme> = {
    px: 1,
    py: 0.25,
    borderRadius: 1,
    border: 1,
    borderColor: "divider",
    color: "text.secondary",
    fontSize: "0.75rem",
    "&[aria-pressed='true']": { bgcolor: "action.selected", color: "text.primary" },
    "&[data-error='true']": { borderColor: "error.main", color: "error.main" },
    "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main", outlineOffset: 1 },
};

/** The request's key for a pick's field, as the playground's backend names it: `media.0.focus`. */
const keyOf =
    (field: string) =>
    ({ index }: PropertyErrorKeyParams) =>
        `media.${index}.${field}`;

/** The request's key for a pick's text in one language: `media.0.translations.en.title`. */
const translationKey = (index: number, code: Language, name: string) => `media.${index}.translations.${code}.${name}`;

/**
 * A field of the playground's own, drawn as it likes: where a picture's crop keeps its subject, set
 * through `save`, which keeps it with the pick at once, and missing while it's off. Its `errorKey` finds its
 * error, which the media manager shows under it; it only marks itself as wrong, and is described by
 * the message.
 */
const FocalPoint = ({ value, save, labelId, error, errorId }: PropertyRenderParams) => (
    <Box role="radiogroup" aria-labelledby={labelId} aria-invalid={error} aria-describedby={errorId} sx={pointsSx}>
        {POINTS.map((point) => (
            <ButtonBase
                key={point}
                role="radio"
                aria-checked={(value ?? "center") === point}
                aria-label={point}
                disabled={!save}
                sx={pointSx}
                onClick={() => save?.(point)}
            />
        ))}
    </Box>
);

interface TranslatedTextProps extends PropertyEditParams {
    /** The text's name in the request's keys: `title` for `media.0.translations.en.title`. */
    name: string;
}

/**
 * One field holding a text in each of the site's languages, `{ en, fr, fa }`, a language at a time
 * under its tab, as a writer fills in only those they write in. Its `errorKey` names a key a
 * language, so the media manager counts it once and shows every language's messages under it; it
 * reads `errors` itself only to mark the tab of each language with one, and starts on the first.
 */
const TranslatedText = ({ name, value, onChange, id, labelId, errors, index, errorId }: TranslatedTextProps) => {
    const texts = (value ?? {}) as Partial<Record<Language, string>>;
    const failing = (code: Language) => index !== undefined && Object.hasOwn(errors, translationKey(index, code, name));
    const [shown, setShown] = useState<Language>(() => LANGUAGES.find(({ code }) => failing(code))?.code ?? "en");
    const language = LANGUAGES.find(({ code }) => code === shown) ?? LANGUAGES[0];

    return (
        <>
            <Box sx={languagesSx}>
                {LANGUAGES.map(({ code, label }) => (
                    <ButtonBase
                        key={code}
                        id={`${id}-${code}`}
                        lang={code}
                        aria-pressed={shown === code}
                        data-error={failing(code)}
                        sx={languageSx}
                        onClick={() => setShown(code)}
                    >
                        {label}
                    </ButtonBase>
                ))}
            </Box>
            <TextField
                id={id}
                size="small"
                fullWidth
                value={texts[shown] ?? ""}
                error={failing(shown)}
                onChange={(event) => onChange({ ...texts, [shown]: event.target.value })}
                slotProps={{
                    htmlInput: {
                        lang: shown,
                        dir: language.dir,
                        "aria-labelledby": `${labelId} ${id}-${shown}`,
                        "aria-describedby": errorId,
                    },
                }}
            />
        </>
    );
};

/** A text in each of the site's languages as one field, under tabs, its errors found a key a language. */
const translated = (name: string, label: string, required = false): PropertyDefinition => ({
    field: name,
    label,
    required,
    errorKey: ({ index }) => LANGUAGES.map(({ code }) => translationKey(index, code, name)),
    render: ({ value }) =>
        Object.values((value ?? {}) as Record<string, string>)
            .filter(Boolean)
            .join(" · "),
    renderEdit: (params) => <TranslatedText {...params} name={name} />,
});

/** A text field in each of the site's languages, under one heading, keyed `name.code`. */
const perLanguage = (
    id: string,
    title: string,
    options: { multiline?: boolean; required?: Language } = {},
): PropertyDefinitionGroup => ({
    id,
    title,
    properties: LANGUAGES.map(({ code, label, dir }) => ({
        field: `${id}.${code}`,
        label,
        type: "string" as const,
        lang: code,
        dir,
        multiline: options.multiline,
        required: options.required === code,
        errorKey: ({ index }: PropertyErrorKeyParams) => translationKey(index, code, id),
    })),
});

const altKeys = LANGUAGES.map(({ code }) => `alt.${code}`);

const titleGroup = perLanguage("title", "Title");
const altGroup = perLanguage("alt", "Alt text", { multiline: true, required: "en" });

/**
 * A picture's: its title, its alt text unless it's decorative, which takes what was written, and how
 * it sits in the slide, its focal point off and forgotten while it's shown whole, when nothing's cut.
 */
const PictureFields = (form: MediaPickFormParams) => {
    const { values, setValues } = form;

    return (
        <MediaFields
            {...form}
            setValues={(next) => {
                const kept = { ...next };

                if (kept.decorative) {
                    altKeys.forEach((key) => delete kept[key]);
                }

                if (kept.fit === "contain") {
                    delete kept.focus;
                }

                setValues(kept);
            }}
            groups={[
                titleGroup,
                ...(values.decorative ? [] : [altGroup]),
                {
                    id: "layout",
                    title: "Layout",
                    properties: [
                        { field: "decorative", label: "Decorative, no alt text", type: "boolean" },
                        {
                            field: "fit",
                            label: "Fit",
                            type: "string",
                            options: [
                                { value: "cover", label: "Fill the slide" },
                                { value: "contain", label: "Show it whole" },
                            ],
                        },
                        {
                            field: "focus",
                            label: "Focal point",
                            disabled: values.fit === "contain",
                            errorKey: keyOf("focus"),
                            render: (params) => <FocalPoint {...params} />,
                        },
                    ],
                },
            ]}
        />
    );
};

const videoGroups: PropertyDefinitionGroup[] = [
    { id: "about", properties: [translated("title", "Title", true)] },
    {
        id: "playback",
        title: "Playback",
        properties: [
            { field: "autoplay", label: "Play on its own, muted", type: "boolean" },
            { field: "loop", label: "Loop", type: "boolean" },
            {
                field: "start",
                label: "Start at (seconds)",
                type: "number",
                min: 0,
                errorKey: keyOf("start"),
            },
            {
                field: "showOn",
                label: "Show on",
                type: "string",
                multiple: true,
                errorKey: keyOf("showOn"),
                options: [
                    { value: "desktop", label: "Desktop" },
                    { value: "tablet", label: "Tablet" },
                    { value: "phone", label: "Phone" },
                ],
            },
        ],
    },
];

const audioGroups: PropertyDefinitionGroup[] = [
    perLanguage("title", "Title"),
    { id: "about", properties: [{ field: "keywords", label: "Keywords", type: "string", multiple: true }] },
];

const documentGroups: PropertyDefinitionGroup[] = [
    perLanguage("link", "Link text"),
    { id: "visibility", properties: [{ field: "until", label: "Show until", type: "date" }] },
];

const FORMS: Record<MediaKind, MediaForm<MediaPickFormParams>> = {
    image: { defaults: { fit: "cover" }, render: (form) => <PictureFields {...form} /> },
    video: { render: (form) => <MediaFields {...form} groups={videoGroups} /> },
    audio: { render: (form) => <MediaFields {...form} groups={audioGroups} /> },
    document: { defaults: { "link.en": "Read it" }, render: (form) => <MediaFields {...form} groups={documentGroups} /> },
};

/** What the carousel asks of each pick, by its kind. */
export const pickForm = (_asset: FileEntry, section: MediaSection) => FORMS[section.kind];
