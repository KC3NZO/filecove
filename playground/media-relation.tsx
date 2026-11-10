import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaFields, MediaPicker, MediaPicture } from "../src";
import { imageUploadForm, videoUploadForm } from "./media-uploads";
import { noOverlap, oneGroup, selectGroups } from "./options";

import type {
    FileAdapter,
    FileEntry,
    MediaChoice,
    MediaPickerValue,
    MediaPickForm,
    MediaSection,
    PropertyDefinition,
    PropertyDefinitionGroup,
    PropertyEditParams,
} from "../src";

// A field pointing at an asset of another library, the playground's own, as the media manager knows of
// no such thing: a group's cover in Images, a series' teaser in Videos and its poster in Images. The dialog and what's kept are the
// app's, and the field holds the asset as it was chosen, where a real backend would keep its id and send
// it back so. Only `MediaPicker` and `MediaPicture` are the component's: the first finds or uploads the asset, and
// nothing can be deleted or moved from it, the second shows it. What's asked of an upload is the library's `uploadForm`, and what's
// about this use of the asset is the picker's `pickForm`, as a gallery's caption for each picture. A gallery holds several, by the
// picker's `multiple`, kept as the picks are, each picture with what its form holds.

/** A gallery's rule, for this use of the picker (`?oneGroup`): one group at most among its pictures. */
const oneGroupAtMost = (entry: FileEntry, _section: MediaSection, choices: readonly MediaChoice[]) =>
    entry.kind !== "folder" || !choices.some(({ asset }) => asset.kind === "folder") || "One group at most";

/**
 * A rule for a use where picking a group means all of it (`?noOverlap`): nothing inside a group picked,
 * and no group with a pick inside it. Ids only mean something within a library's adapter.
 */
export const noOverlapping = (
    entry: FileEntry,
    section: MediaSection,
    choices: readonly MediaChoice[],
    trail: readonly FileEntry[] | undefined,
) => {
    const here = choices.filter((choice) => choice.section.id === section.id);

    if (trail?.some(({ id }) => here.some(({ asset }) => asset.id === id))) {
        return "Already in a picked group";
    }

    return !here.some((choice) => choice.trail?.some(({ id }) => id === entry.id)) || "Holds something picked already";
};

// The same libraries as the page's, without what's for managing them, which a picker doesn't read.
const VIDEOS: MediaSection = {
    id: "videos",
    label: "Videos",
    kind: "video",
    rootId: "/videos",
    layouts: ["grid", "list"],
    acceptUploads: "video/*",
    uploadForm: videoUploadForm,
};

const IMAGES: MediaSection = {
    id: "images",
    label: "Images",
    kind: "image",
    rootId: "/images",
    layouts: ["grid", "list"],
    acceptUploads: "image/*",
    uploadForm: imageUploadForm,
};

const CAPTION_GROUPS: PropertyDefinitionGroup[] = [
    { id: "gallery", properties: [{ field: "caption", label: "Caption", type: "string", required: true }] },
];

// What's asked of each picture for this gallery, which the library knows nothing of.
const CAPTION_FORM: MediaPickForm = {
    defaults: { caption: "" },
    render: (form) => <MediaFields {...form} groups={CAPTION_GROUPS} />,
    ready: ({ values }) => !!String(values.caption ?? "").trim() || "Write a caption for each picture.",
};

const captionForm = () => CAPTION_FORM;

const rowSx: SxProps<Theme> = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 };

const listSx: SxProps<Theme> = { display: "flex", flexDirection: "column", gap: 1 };

const pictureSx: SxProps<Theme> = { width: 72, aspectRatio: "16 / 9" };

const nameSx: SxProps<Theme> = { flex: "1 1 6rem", minWidth: 0, overflowWrap: "anywhere" };

const dialogSx: SxProps<Theme> = { "& .MuiDialog-paper": { height: "min(85dvh, 760px)" } };

interface ChosenProps {
    entry: FileEntry;
    adapter: FileAdapter;
    /** What's written about this use of it, under its name. */
    caption?: string;
}

const Chosen = ({ entry, adapter, caption }: ChosenProps) => (
    <>
        <MediaPicture entry={entry} adapter={adapter} sx={pictureSx} />
        <Typography component="div" variant="body2" sx={nameSx}>
            <bdi>{entry.name}</bdi>
            {caption && (
                <Typography variant="caption" color="text.secondary" component="div">
                    <bdi>{caption}</bdi>
                </Typography>
            )}
        </Typography>
    </>
);

interface RelationFieldProps extends PropertyEditParams {
    section: MediaSection;
}

/** What's chosen, Choose or Change opening the picker in a dialog, and Remove. */
const RelationField = ({ section, value, onChange, adapter, labelId, disabled }: RelationFieldProps) => {
    const chosen = value as FileEntry | undefined;
    const [open, setOpen] = useState(false);

    return (
        <Box sx={rowSx}>
            {chosen && <Chosen entry={chosen} adapter={adapter} />}
            <Button size="small" variant="outlined" color="inherit" disabled={disabled} onClick={() => setOpen(true)}>
                {chosen ? "Change" : `Choose from ${section.label}`}
            </Button>
            {chosen && (
                <Button size="small" color="inherit" disabled={disabled} onClick={() => onChange(undefined)}>
                    Remove
                </Button>
            )}
            <Dialog
                open={open}
                fullWidth
                maxWidth="md"
                aria-labelledby={labelId}
                sx={dialogSx}
                onClose={() => setOpen(false)}
            >
                <MediaPicker
                    selectGroups={selectGroups}
                    adapter={adapter}
                    section={section}
                    allowUpload
                    defaultValue={chosen ? [{ asset: chosen }] : undefined}
                    onCancel={() => setOpen(false)}
                    onChoose={([choice]) => {
                        onChange(choice.asset);
                        setOpen(false);
                    }}
                />
            </Dialog>
        </Box>
    );
};

interface RelationsFieldProps extends RelationFieldProps {
    /** How many it can hold. */
    maxChoices?: number;
}

/**
 * What's chosen, each with its Remove, in the order set, and Choose or Change opening the picker on
 * them, with what's written about each, so what's there can be added to, taken from, put in order or
 * written about again. A wider dialog, for the selected column to dock beside the library.
 */
const RelationsField = ({ section, maxChoices, value, onChange, adapter, labelId, disabled }: RelationsFieldProps) => {
    const chosen = (value as MediaPickerValue[] | undefined) ?? [];
    const [open, setOpen] = useState(false);

    return (
        <Box sx={listSx}>
            {chosen.map(({ asset, values }) => (
                <Box key={asset.id} sx={rowSx}>
                    <Chosen entry={asset} adapter={adapter} caption={String(values?.caption ?? "")} />
                    <Button
                        size="small"
                        color="inherit"
                        disabled={disabled}
                        onClick={() => {
                            const rest = chosen.filter((each) => each.asset.id !== asset.id);

                            onChange(rest.length > 0 ? rest : undefined);
                        }}
                    >
                        Remove
                    </Button>
                </Box>
            ))}
            <Box sx={rowSx}>
                <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    disabled={disabled}
                    onClick={() => setOpen(true)}
                >
                    {chosen.length > 0 ? "Change" : `Choose from ${section.label}`}
                </Button>
            </Box>
            <Dialog
                open={open}
                fullWidth
                maxWidth="lg"
                aria-labelledby={labelId}
                sx={dialogSx}
                onClose={() => setOpen(false)}
            >
                <MediaPicker
                    selectGroups={selectGroups}
                    canSelect={oneGroup ? oneGroupAtMost : noOverlap ? noOverlapping : undefined}
                    adapter={adapter}
                    section={section}
                    multiple
                    maxChoices={maxChoices}
                    allowUpload
                    pickForm={captionForm}
                    defaultValue={chosen}
                    onCancel={() => setOpen(false)}
                    onChoose={(choices) => {
                        onChange(choices.map(({ asset, values }) => ({ asset, values })));
                        setOpen(false);
                    }}
                />
            </Dialog>
        </Box>
    );
};

/** A field pointing at an asset of a library: chosen in a form, and shown in the details. */
const relation = (field: string, label: string, section: MediaSection): PropertyDefinition => ({
    field,
    label,
    render: ({ value, adapter }) =>
        value ? (
            <Box sx={rowSx}>
                <Chosen entry={value as FileEntry} adapter={adapter} />
            </Box>
        ) : null,
    renderEdit: (params) => <RelationField {...params} section={section} />,
});

/** A field pointing at several assets of a library. */
const relations = (field: string, label: string, section: MediaSection, maxChoices?: number): PropertyDefinition => ({
    field,
    label,
    render: ({ value, adapter }) => {
        const chosen = (value as MediaPickerValue[] | undefined) ?? [];

        return chosen.length > 0 ? (
            <Box sx={listSx}>
                {chosen.map(({ asset, values }) => (
                    <Box key={asset.id} sx={rowSx}>
                        <Chosen entry={asset} adapter={adapter} caption={String(values?.caption ?? "")} />
                    </Box>
                ))}
            </Box>
        ) : null;
    },
    renderEdit: (params) => <RelationsField {...params} section={section} maxChoices={maxChoices} />,
});

export const coverField = relation("cover", "Cover", IMAGES);
export const teaserField = relation("teaser", "Teaser", VIDEOS);
export const posterField = relation("poster", "Poster", IMAGES);
export const galleryField = relations("gallery", "Gallery", IMAGES, 6);
