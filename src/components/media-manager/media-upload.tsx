import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import { uploadPatterns } from "../../utils/files";
import { FileTypeIcon } from "../icons/file-icon";
import { MediaFormBody } from "./media-form";
import MediaStep from "./media-step";

import type { FileAdapter, MediaForm, MediaSection, MediaUploadCheck, MediaUploadFormParams } from "../../types";

interface MediaUploadProps {
    section: MediaSection;
    /** The library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /** What was given, as the check before sending sorted it. */
    check: MediaUploadCheck;
    /** What the library asks of these files: its upload form, for them, or nothing. */
    form: MediaForm<MediaUploadFormParams> | null;
    onCancel: () => void;
    /** Sends the files, with what the upload form holds. */
    onUpload: (values: Readonly<Record<string, unknown>>) => void;
}

const notesSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
};

const listSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    m: 0,
    p: 0,
    listStyle: "none",
};

const fileSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minWidth: 0,
    py: 0.75,
};

const fileNameSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    fontSize: "0.875rem",
};

const fileSizeSx: SxProps<Theme> = {
    flexShrink: 0,
    color: "text.secondary",
    fontSize: "0.8125rem",
};

// The form under the files, set apart by a rule, as a pick's form is under its heading.
const fieldsSx: SxProps<Theme> = {
    pt: 2,
    borderTop: 1,
    borderColor: "divider",
};

/**
 * The step before files are uploaded into a library, in its place, as the asset view is: what's
 * about to go, what's left out and why, and the library's upload form for them, with Cancel and
 * Upload; or, with nothing left to send, why, with Close. Shown only when there's something to ask or
 * to say.
 */
const MediaUpload = ({ section, adapter, check, form, onCancel, onUpload }: MediaUploadProps) => {
    const { text, describeAccepted, formatSize } = useLocale();
    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...form?.defaults }));
    const { files, refused, folders, misnamed } = check;
    const patterns = uploadPatterns(section);
    const types = patterns ? describeAccepted(patterns) : "";
    const library = isolate(section.label);
    const sending = files.length > 0;

    const title = sending
        ? text.uploadTitle(files.length, isolate(files[0].name), library)
        : refused.length + misnamed.length > 0
          ? text.uploadFailedTitle(
                refused.length + folders.length + misnamed.length,
                isolate((refused[0] ?? misnamed[0]).name),
            )
          : text.uploadFoldersFailedTitle(folders.length, isolate(folders[0]?.name ?? ""));

    const notes = [
        folders.length > 0 &&
            (sending ? text.uploadFoldersLeftOut(folders.length, isolate(folders[0].name)) : text.uploadFoldersOnly),
        refused.length > 0 &&
            (sending
                ? text.uploadTypesLeftOut(refused.length, isolate(refused[0].name), library, types)
                : text.uploadTypesOnly(library, types)),
        misnamed.length > 0 &&
            text.uploadNamesRefused(misnamed.length, isolate(misnamed[0].name), isolate(misnamed[0].reason)),
    ].filter((note): note is string => !!note);

    return (
        <MediaStep
            title={title}
            backLabel={text.mediaBackToLibrary(section.label)}
            onBack={onCancel}
            footer={
                sending ? (
                    <>
                        <Button color="inherit" onClick={onCancel}>
                            {text.cancel}
                        </Button>
                        <Button variant="contained" disableElevation onClick={() => onUpload(values)}>
                            {text.upload}
                        </Button>
                    </>
                ) : (
                    <Button variant="contained" disableElevation onClick={onCancel}>
                        {text.close}
                    </Button>
                )
            }
        >
            {notes.length > 0 && (
                <Box sx={notesSx}>
                    {notes.map((note) => (
                        <Typography key={note} variant="body2" color="text.secondary">
                            {note}
                        </Typography>
                    ))}
                </Box>
            )}
            {sending && (
                <Box component="ul" aria-label={text.mediaUploadFiles} sx={listSx}>
                    {files.map((file, index) => (
                        <Box component="li" key={index} sx={fileSx}>
                            <FileTypeIcon fileName={file.name} size={24} />
                            <Typography noWrap sx={fileNameSx}>
                                {file.name}
                            </Typography>
                            <Typography component="span" sx={fileSizeSx}>
                                <bdi>{formatSize(file.size)}</bdi>
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
            {sending && form && (
                <Box sx={fieldsSx}>
                    <MediaFormBody form={form} params={{ files, section, adapter, values, setValues }} />
                </Box>
            )}
        </MediaStep>
    );
};

export default MediaUpload;
