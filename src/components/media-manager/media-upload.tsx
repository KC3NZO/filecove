import { useEffect, useId, useMemo, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { focusOutline } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { NO_ERRORS, NO_MESSAGES } from "../../utils/field-errors";
import { uploadPatterns } from "../../utils/files";
import { asksAnything, uploadStandIn } from "../../utils/media";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import ChoiceFields from "./choice-fields";

import type { FileAdapter, MediaSection, MediaUploadCheck, PropertyDefinitionGroup } from "../../types";

interface MediaUploadProps {
    section: MediaSection;
    /** The library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /** What was given, as the check before sending sorted it. */
    check: MediaUploadCheck;
    /** What the library asks of these files: its upload fields, for them. */
    groups: readonly PropertyDefinitionGroup[];
    onCancel: () => void;
    /** Sends the files, with what the upload fields hold. */
    onUpload: (values: Readonly<Record<string, unknown>>) => void;
}

const NO_VALUES: Readonly<Record<string, unknown>> = {};

// Over the library, in its place, as the asset view is, its grid kept underneath as it was.
const rootSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    bgcolor: "background.paper",
    outline: "none",
    "&:focus-visible": { ...focusOutline, borderRadius: "inherit" },
};

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    flexShrink: 0,
    minHeight: 52,
    paddingInlineStart: 0.5,
    paddingInlineEnd: 1.5,
    borderBottom: 1,
    borderColor: "divider",
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    px: 0.5,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const bodySx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
};

// A column of a form's width, in the middle of the library's room.
const columnSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    maxWidth: "36rem",
    marginInline: "auto",
    px: 2,
    py: 2,
};

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

// The fields under the files, set apart by a rule, as a pick's fields are under its heading.
const fieldsSx: SxProps<Theme> = {
    pt: 2,
    borderTop: 1,
    borderColor: "divider",
};

const footerSx: SxProps<Theme> = {
    display: "flex",
    justifyContent: "flex-end",
    gap: 1,
    flexShrink: 0,
    p: 1.5,
    borderTop: 1,
    borderColor: "divider",
};

/**
 * The step before files are uploaded into a library, in its place, as the asset view is: what's
 * about to go, what's left out and why, and the library's upload fields for them, filled in with its
 * defaults, with Cancel and Upload; or, with nothing left to send, why, with Close. Shown only when
 * there's something to ask or to say.
 */
const MediaUpload = ({ section, adapter, check, groups, onCancel, onUpload }: MediaUploadProps) => {
    const { text, describeAccepted, formatSize } = useLocale();
    const titleId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const [values, setValues] = useState(section.uploadDefaults ?? NO_VALUES);
    const { files, refused, folders, misnamed } = check;
    const standIn = useMemo(() => uploadStandIn(files), [files]);
    const patterns = uploadPatterns(section);
    const types = patterns ? describeAccepted(patterns) : "";
    const library = isolate(section.label);
    const sending = files.length > 0;

    // Takes the focus as it opens, so it's read out by its title.
    useEffect(() => rootRef.current?.focus(), []);

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
        <Box
            component="section"
            ref={rootRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            sx={rootSx}
            onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel();
                }
            }}
        >
            <Box sx={headerSx}>
                <TooltipIconButton label={text.mediaBackToLibrary(section.label)} onClick={onCancel}>
                    <Icon name="arrowBack" fontSize="small" />
                </TooltipIconButton>
                <Typography id={titleId} component="h2" noWrap sx={titleSx}>
                    {title}
                </Typography>
            </Box>
            <Box sx={bodySx}>
                <Box sx={columnSx}>
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
                    {sending && asksAnything(groups) && (
                        <Box sx={fieldsSx}>
                            <ChoiceFields
                                groups={groups}
                                values={values}
                                asset={standIn}
                                adapter={adapter}
                                errors={NO_ERRORS}
                                index={undefined}
                                messages={NO_MESSAGES}
                                files={files}
                                onChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))}
                            />
                        </Box>
                    )}
                </Box>
            </Box>
            <Box sx={footerSx}>
                {sending ? (
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
                )}
            </Box>
        </Box>
    );
};

export default MediaUpload;
