import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaPicker, MediaPicture } from "../src";
import { imageUploadForm, videoUploadForm } from "./media-uploads";

import type { FileAdapter, FileEntry, MediaSection, PropertyDefinition, PropertyEditParams } from "../src";

// A field pointing at an asset of another library, the playground's own, as the media manager knows of
// no such thing: a series' teaser in Videos and its poster in Images. The dialog and what's kept are the
// app's, and the field holds the asset as it was chosen, where a real backend would keep its id and send
// it back so. Only `MediaPicker` and `MediaPicture` are the component's: the first finds or uploads the asset, and
// nothing can be deleted or moved from it, the second shows it. What's asked of an upload is the library's `uploadForm`, and anything about
// this use of the asset would be a field beside this one.

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

const rowSx: SxProps<Theme> = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 };

const pictureSx: SxProps<Theme> = { width: 72, aspectRatio: "16 / 9" };

const nameSx: SxProps<Theme> = { flex: "1 1 6rem", minWidth: 0, overflowWrap: "anywhere" };

const dialogSx: SxProps<Theme> = { "& .MuiDialog-paper": { height: "min(85dvh, 760px)" } };

const Chosen = ({ entry, adapter }: { entry: FileEntry; adapter: FileAdapter }) => (
    <>
        <MediaPicture entry={entry} adapter={adapter} sx={pictureSx} />
        <Typography variant="body2" sx={nameSx}>
            <bdi>{entry.name}</bdi>
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
                    adapter={adapter}
                    section={section}
                    allowUpload
                    defaultValue={chosen ? [chosen] : undefined}
                    onCancel={() => setOpen(false)}
                    onChoose={([asset]) => {
                        onChange(asset);
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

export const teaserField = relation("teaser", "Teaser", VIDEOS);
export const posterField = relation("poster", "Poster", IMAGES);
