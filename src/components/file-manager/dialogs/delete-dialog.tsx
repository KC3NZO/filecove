import { useEffect, useMemo, useRef, useState } from "react";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFolder } from "../../../hooks/use-folder";
import { dialogPaperSx } from "../../../styles/mixins";
import { folderOf } from "../../../utils/navigation";

import type { FileAdapter, FileEntry, FolderRef, Section } from "../../../types";

export interface DeleteRequest {
    section: Section;
    /** The section's adapter, already known to support deleting. */
    adapter: FileAdapter;
    /** Trail to the folder the entries are in. */
    trail: FolderRef[];
    entries: FileEntry[];
}

export interface DeleteDialogState {
    /** False while the dialog plays its closing transition; the rest is kept so it doesn't empty mid-fade. */
    open: boolean;
    /** Counts requests, so each one starts afresh. */
    id: number;
    request: DeleteRequest;
}

interface DeleteDialogProps {
    open: boolean;
    request: DeleteRequest;
    onClose: () => void;
    /** Called once the adapter has deleted the entries. */
    onDone: (request: DeleteRequest) => void;
}

const contentSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
};

/**
 * Asks to confirm deleting entries, then has the adapter delete them. Deleting can't be undone, so
 * nothing is deleted without asking. Anything the adapter rejects with is shown in the dialog,
 * which stays open to try again.
 */
const DeleteDialog = ({ open, request, onClose, onDone }: DeleteDialogProps) => {
    const { section, adapter, trail, entries } = request;
    const parent = folderOf(section, trail);

    const { reload } = useFolder(section, parent.id, false);
    const grandparent = useFolder(section, folderOf(section, trail.slice(0, -1)).id, false);

    const [pending, setPending] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => () => controller.current?.abort(), []);

    // Delete is focused once the dialog has faded in, so Enter confirms and Escape cancels. The
    // context menu hands focus back to where it was opened from as it closes, which would win over
    // `autoFocus`.
    const slotProps = useMemo(
        () => ({
            paper: { sx: dialogPaperSx },
            transition: { onEntered: () => confirmRef.current?.focus() },
        }),
        [],
    );

    // The folder is listed again, and so is its parent's listing when cached, for its item count.
    const refresh = () => {
        reload();

        if (trail.length > 0 && grandparent.state) {
            grandparent.reload();
        }
    };

    // Cancelling can't bring back what the backend has already deleted, so the folder is listed again.
    const close = () => {
        if (controller.current) {
            controller.current.abort();
            controller.current = null;
            refresh();
        }

        onClose();
    };

    const confirm = () => {
        if (pending) {
            return;
        }

        const current = new AbortController();

        controller.current = current;
        setPending(true);
        setFailure(null);

        // Wrapped so an adapter that throws synchronously still ends up as a failure.
        Promise.resolve()
            .then(() => {
                if (!adapter.delete) {
                    throw new Error("Not supported here.");
                }

                return adapter.delete(entries, { signal: current.signal });
            })
            .then(
                () => {
                    if (!current.signal.aborted) {
                        controller.current = null;
                        refresh();
                        onDone(request);
                    }
                },
                (error: unknown) => {
                    if (!current.signal.aborted) {
                        controller.current = null;
                        // Some of the entries may be gone even so.
                        refresh();
                        setPending(false);
                        setFailure(
                            error instanceof Error && error.message
                                ? error.message
                                : `Couldn't delete ${entries.length === 1 ? "it" : "them"}.`,
                        );
                    }
                },
            );
    };

    const single = entries.length === 1;
    const what = single ? `“${entries[0].name}”` : `${entries.length} items`;
    const hasFolders = entries.some((entry) => entry.kind === "folder");
    const folderNote = !hasFolders
        ? ""
        : single
          ? "Everything in it is deleted too. "
          : "Folders are deleted with everything in them. ";

    return (
        <Dialog open={open} fullWidth maxWidth="xs" slotProps={slotProps} onClose={close}>
            <DialogTitle>Delete {what}?</DialogTitle>
            <DialogContent sx={contentSx}>
                <Typography variant="body2" color="text.secondary">
                    {folderNote}This can't be undone.
                </Typography>
                {failure && (
                    <Typography variant="body2" color="error">
                        {failure}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={close}>
                    Cancel
                </Button>
                <Button ref={confirmRef} variant="contained" color="error" loading={pending} onClick={confirm}>
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteDialog;
