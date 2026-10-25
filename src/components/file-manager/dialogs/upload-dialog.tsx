import { useContext, useEffect, useMemo, useRef, useState } from "react";

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
import { dialogActionsSx } from "../../../styles/direction";
import { dialogPaperSx } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import { acceptsFile, uploadPatterns } from "../../../utils/files";
import { freeName } from "../../../utils/names";
import { folderOf } from "../../../utils/navigation";
import { findClashes } from "../../../utils/transfer";
import { ConflictChoices, ConflictMessage } from "./conflict-step";

import type {
    Clash,
    ConflictPolicy,
    DroppedFiles,
    FileAdapter,
    FileEntry,
    FolderRef,
    FolderUpload,
    Section,
} from "../../../types";

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
    /** Called once nothing is left to ask, with the files and folders to upload and how to settle clashes. */
    onUpload: (request: UploadRequest, files: File[], folders: FolderUpload[], conflict: ConflictPolicy) => void;
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
 * Checks files and folders about to be uploaded into a folder before they're queued. Most uploads
 * need nothing from the user, so this runs unseen, and the dialog only shows to ask about names the
 * folder already has (replace or merge, keep both, or skip), or to say that folders, where the
 * adapter can't make any, or files of types the section doesn't take (`acceptUploads`), were left
 * out. What's inside the folders is only read once they're queued.
 */
const UploadDialog = ({ open, request, onClose, onUpload }: UploadDialogProps) => {
    const { section, adapter, trail, dropped } = request;
    const target = folderOf(section, trail);
    const { text, describeAccepted } = useLocale();
    const patterns = uploadPatterns(section);
    const files = dropped.files.filter((file) => acceptsFile(patterns, file));
    const refused = dropped.files.filter((file) => !acceptsFile(patterns, file));
    // Folders are made with the adapter's `createFolder`, so without it they're left out.
    const folders = adapter.createFolder ? dropped.folders : [];
    const leftOut = adapter.createFolder ? [] : dropped.folders;
    const types = patterns ? describeAccepted(patterns) : "";
    const dir = useContext(DirectionContext);

    // The folder is listed first when it isn't cached, as a folder dropped onto may never have been
    // opened, and its clashes are only looked for once all its pages have come.
    const { state } = useFolder(section, target.id, true);
    const listed = (!!state?.entries && !state.partial) || state?.status === "error";
    const byName = useMemo(
        () => new Map(state?.entries?.map((entry): [string, FileEntry] => [entry.name, entry])),
        [state?.entries],
    );

    // A ref rather than state: React's development double mount runs the effect below twice before
    // any re-render, and state set by the first run wouldn't be seen by the second, which would
    // queue the files again.
    const checked = useRef(false);
    const [conflicts, setConflicts] = useState<Clash[] | null>(null);

    // Files to skip are left out here rather than sent for the adapter to skip, since sending them
    // could take a long time for nothing. "skip" still goes along for clashes the cache missed. A
    // folder is merged into the one of its name with Replace, and otherwise, or where a file has its
    // name, made under a free name, one neither there nor uploaded beside it, since `createFolder`
    // can't replace or keep both. With Replace, a file whose name a folder has is kept beside it
    // (`startUpload` in `file-manager.tsx`).
    const upload = (conflict: ConflictPolicy, clashes = conflicts ?? []) => {
        const skipped = new Set(conflict === "skip" ? clashes.map((clash) => clash.name) : []);
        const taken = new Set([...byName.keys(), ...files.map(({ name }) => name), ...folders.map(({ name }) => name)]);
        const planned = folders.flatMap((source): FolderUpload[] => {
            const there = byName.get(source.name);

            if (skipped.has(source.name)) {
                return [];
            }

            if (!there) {
                return [{ source, name: source.name }];
            }

            if (conflict === "replace" && there.kind === "folder") {
                return [{ source, name: source.name, mergeInto: there.id }];
            }

            const name = freeName(source.name, taken, text);

            taken.add(name);

            return [{ source, name }];
        });

        onUpload(
            request,
            files.filter((file) => !skipped.has(file.name)),
            planned,
            conflict,
        );
    };

    // Once the folder's listing is there, it's checked for names the files and folders share, and
    // with nothing to ask or say, they're queued. Each request mounts a new dialog, so this runs once per request.
    useEffect(() => {
        if (checked.current || !listed) {
            return;
        }

        const clashes = findClashes(
            [
                ...files.map(({ name }) => ({ name, kind: "file" as const })),
                ...folders.map(({ name }) => ({ name, kind: "folder" as const })),
            ],
            state?.entries,
        );

        checked.current = true;

        if (clashes.length > 0 || leftOut.length > 0 || refused.length > 0) {
            setConflicts(clashes);
        } else {
            upload("keepBoth", clashes);
        }
    }, [listed]);

    // Only folders the adapter can't make, or files of types the section doesn't take, so there's
    // nothing to upload.
    if (files.length === 0 && folders.length === 0) {
        return (
            <Dialog
                dir={dir}
                open={open && !!conflicts}
                fullWidth
                maxWidth="xs"
                slotProps={slotProps}
                onClose={onClose}
            >
                <DialogTitle>
                    {refused.length > 0
                        ? text.uploadFailedTitle(refused.length + leftOut.length, isolate(refused[0].name))
                        : text.uploadFoldersFailedTitle(leftOut.length, isolate(leftOut[0]?.name ?? ""))}
                </DialogTitle>
                <DialogContent sx={contentSx}>
                    {leftOut.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                            {text.uploadFoldersOnly}
                        </Typography>
                    )}
                    {refused.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                            {text.uploadTypesOnly(isolate(section.label), types)}
                        </Typography>
                    )}
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
            <DialogTitle>
                {text.uploadTitle(
                    files.length + folders.length,
                    isolate((files[0] ?? folders[0]).name),
                    isolate(target.name),
                )}
            </DialogTitle>
            <DialogContent sx={contentSx}>
                {conflicts && conflicts.length > 0 && (
                    <ConflictMessage clashes={conflicts} folderName={target.name} />
                )}
                {leftOut.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {text.uploadFoldersLeftOut(leftOut.length, isolate(leftOut[0].name))}
                    </Typography>
                )}
                {refused.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {text.uploadTypesLeftOut(
                            refused.length,
                            isolate(refused[0].name),
                            isolate(section.label),
                            types,
                        )}
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
                        <ConflictChoices clashes={conflicts} pending={null} onChoose={upload} />
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
