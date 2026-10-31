import { useId } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import type {
    FileEntry,
    MediaSection,
    PropertyDefinitionGroup,
    PropertyErrorKeyParams,
    PropertyRenderParams,
} from "../src";

// The playground's own fields for each pick (`fields`), as a site's carousel would have them:
// everything here is the app's, its languages too, a field per language. Each is a property's
// definition, as what an asset shows is. The media manager only draws them, keeps what's filled in
// with the pick, and hands it back with what's chosen. Each finds its error in what the playground's
// backend answers (`mocks/mock-save.ts`) by its `errorKey`, the request's key for it, but the focal
// point, which reads `errors` itself, as a field the app draws may.

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

const focusErrorSx: SxProps<Theme> = {
    mt: 0.75,
    color: "error.main",
    fontSize: "0.75rem",
};

/** The request's key for a pick's field, as the playground's backend names it: `items.0.title.en`. */
const keyOf =
    (field: string) =>
    ({ index }: PropertyErrorKeyParams) =>
        `items.${index}.${field}`;

/**
 * A field of the playground's own, drawn as it likes: where a picture's crop keeps its subject, set
 * through `save`, which in a pick's fields keeps it with the pick at once. It has no `errorKey`, and
 * finds its error itself, in the `errors` it's handed, by the pick's `index`.
 */
const FocalPoint = ({ value, save, labelId, errors, index }: PropertyRenderParams) => {
    const errorId = useId();
    const found = index === undefined ? undefined : errors[`items.${index}.focus`];
    const message = typeof found === "string" ? found : found?.[0];

    return (
        <>
            <Box
                role="radiogroup"
                aria-labelledby={labelId}
                aria-invalid={message !== undefined}
                aria-describedby={message === undefined ? undefined : errorId}
                sx={pointsSx}
            >
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
            {message !== undefined && (
                <Typography id={errorId} sx={focusErrorSx}>
                    {message}
                </Typography>
            )}
        </>
    );
};

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
        errorKey: keyOf(`${id}.${code}`),
    })),
});

/** What the carousel asks of each pick, by its kind: the media manager draws whatever this returns. */
export const pickFields = (_asset: FileEntry, section: MediaSection): PropertyDefinitionGroup[] => {
    switch (section.kind) {
        case "image":
            return [
                perLanguage("title", "Title"),
                perLanguage("alt", "Alt text", { multiline: true, required: "en" }),
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
                        { field: "focus", label: "Focal point", render: (params) => <FocalPoint {...params} /> },
                    ],
                },
            ];
        case "video":
            return [
                perLanguage("title", "Title", { required: "en" }),
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
        case "audio":
            return [
                perLanguage("title", "Title"),
                { id: "about", properties: [{ field: "keywords", label: "Keywords", type: "string", multiple: true }] },
            ];
        case "document":
            return [
                perLanguage("link", "Link text"),
                { id: "visibility", properties: [{ field: "until", label: "Show until", type: "date" }] },
            ];
    }
};
