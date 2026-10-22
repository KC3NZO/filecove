import { useContext, useEffect, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { clashingNames } from "../../../hooks/use-transfer";
import { dialogActionsSx } from "../../../styles/direction";
import { dialogPaperSx } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import { folderOf } from "../../../utils/navigation";
import { ConflictChoices, ConflictMessage } from "./conflict-step";

import type { ConflictPolicy, DroppedFiles, FileAdapter, FolderRef, Section } from "../../../types";

export interface UploadRequest {
    /** The section of the folder uploaded into. */
    section: Section;
    /** The section's adapter, already known to take uploads. */
    adapter: FileAdapter;
    /** Trail to the folder uploaded into. */
    trail: FolderRef[];
    dropped: DroppedFiles;
}

export interface UploadDialogState {
    /** False once the files are queued, or while the dialog plays its closing transition. */
    open: boolean;
    /** Counts requests, so each one starts afresh. */
    id: number;
    request: UploadRequest;
}

interface UploadDialogProps {
    open: boolean;
    request: UploadRequest;
    onClose: () => void;
    /** Called once nothing is left to ask, with the files to upload and how to settle clashes. */
    onUpload: (request: UploadRequest, files: File[], conflict: ConflictPolicy) => void;
}

const slotProps = {
    paper: { sx: dialogPaperSx },
};

const contentSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
};

const spacerSx: SxProps<Theme> = {
    flex: 1,
};

/**
 * Checks files about to be uploaded into a folder before they're queued. Most uploads need nothing
 * from the user, so this runs unseen, and the dialog only shows to ask about names the folder
 * already has (replace, keep both or skip), or to say that dropped folders were left out.
 */
const UploadDialog = ({ open, request, onClose, onUpload }: UploadDialogProps) => {
    const { section, trail, dropped } = request;
    const { files, folders } = dropped;
    const target = folderOf(section, trail);
    const { text } = useLocale();
    const dir = useContext(DirectionContext);

    // The folder is listed first when it isn't cached, as a folder dropped onto may never have been
    // opened, and its clashes are only looked for once all its pages have come.
    const { state } = useFolder(section, target.id, true);
    const listed = (!!state?.entries && !state.partial) || state?.status === "error";

    // A ref rather than state: React's development double mount runs the effect below twice before
    // any re-render, and state set by the first run wouldn't be seen by the second, which would
    // queue the files again.
    const checked = useRef(false);
    const [conflicts, setConflicts] = useState<string[] | null>(null);

    // Files to skip are left out here rather than sent for the adapter to skip, since sending them
    // could take a long time for nothing. "skip" still goes along for clashes the cache missed.
    const upload = (conflict: ConflictPolicy, clashes = conflicts ?? []) => {
        const skipped = new Set(conflict === "skip" ? clashes : []);

        onUpload(
            request,
            files.filter((file) => !skipped.has(file.name)),
            conflict,
        );
    };

    // Once the folder's listing is there, it's checked for names the files share, and with nothing
    // to ask or say, the files are queued. Each request mounts a new dialog, so this runs once per request.
    useEffect(() => {
        if (checked.current || !listed) {
            return;
        }

        const clashes = clashingNames(files, state?.entries);

        checked.current = true;

        if (clashes.length > 0 || folders.length > 0) {
            setConflicts(clashes);
        } else {
            upload("keepBoth", clashes);
        }
    }, [listed]);

    // Only folders were dropped, so there's nothing to upload.
    if (files.length === 0) {
        return (
            <Dialog
                dir={dir}
                open={open && !!conflicts}
                fullWidth
                maxWidth="xs"
                slotProps={slotProps}
                onClose={onClose}
            >
                <DialogTitle>{text.uploadFoldersFailedTitle(folders.length, isolate(folders[0]))}</DialogTitle>
                <DialogContent sx={contentSx}>
                    <Typography variant="body2" color="text.secondary">
                        {text.uploadFoldersOnly}
                    </Typography>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button variant="contained" onClick={onClose}>
                        {text.close}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    return (
        <Dialog dir={dir} open={open && !!conflicts} fullWidth maxWidth="xs" slotProps={slotProps} onClose={onClose}>
            <DialogTitle>{text.uploadTitle(files.length, isolate(files[0].name), isolate(target.name))}</DialogTitle>
            <DialogContent sx={contentSx}>
                {conflicts && conflicts.length > 0 && <ConflictMessage names={conflicts} folderName={target.name} />}
                {folders.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {text.uploadFoldersLeftOut(folders.length, isolate(folders[0]))}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button color="inherit" onClick={onClose}>
                    {text.cancel}
                </Button>
                {conflicts && conflicts.length > 0 ? (
                    <>
                        <Box sx={spacerSx} />
                        <ConflictChoices pending={null} onChoose={upload} />
                    </>
                ) : (
                    <Button variant="contained" onClick={() => upload("keepBoth")}>
                        {text.upload}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default UploadDialog;
