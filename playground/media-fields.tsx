import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import type { SxProps, Theme } from "@mui/material/styles";

import type { FileEntry, MediaSection, PropertyDefinitionGroup, PropertyRenderParams } from "../src";

// The playground's own fields for each pick (`fields`), as a site's carousel would have them:
// everything here is the app's, its languages too, a field per language. Each is a property's
// definition, as what an asset shows is. The media manager only draws them, keeps what's filled in
// with the pick, and hands it back with what's chosen.

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
};

/**
 * A field of the playground's own, drawn as it likes: where a picture's crop keeps its subject, set
 * through `save`, which in a pick's fields keeps it with the pick at once.
 */
const FocalPoint = ({ value, save, labelId }: PropertyRenderParams) => (
    <Box role="radiogroup" aria-labelledby={labelId} sx={pointsSx}>
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
                perLanguage("title", "Title"),
                {
                    id: "playback",
                    title: "Playback",
                    properties: [
                        { field: "autoplay", label: "Play on its own, muted", type: "boolean" },
                        { field: "loop", label: "Loop", type: "boolean" },
                        { field: "start", label: "Start at (seconds)", type: "number", min: 0 },
                        {
                            field: "showOn",
                            label: "Show on",
                            type: "string",
                            multiple: true,
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
