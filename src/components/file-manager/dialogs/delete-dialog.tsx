import { useContext, useEffect, useMemo, useRef, useState } from "react";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useLocale } from "../../../hooks/use-locale";
import { dialogActionsSx } from "../../../styles/direction";
import { dialogPaperSx } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
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
    /**
     * Called whenever the adapter may have changed folders, done, failed or cancelled, with their
     * ids, to list them again wherever they're shown.
     */
    onChanged: (adapter: FileAdapter, folderIds: string[]) => void;
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
const DeleteDialog = ({ open, request, onClose, onChanged, onDone }: DeleteDialogProps) => {
    const { section, adapter, trail, entries } = request;
    const { text } = useLocale();
    const dir = useContext(DirectionContext);

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

    const refresh = () => onChanged(adapter, [folderOf(section, trail).id]);

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
                                ? isolate(error.message)
                                : text.deleteFailed(entries.length),
                        );
                    }
                },
            );
    };

    const hasFolders = entries.some((entry) => entry.kind === "folder");

    return (
        <Dialog dir={dir} open={open} fullWidth maxWidth="xs" slotProps={slotProps} onClose={close}>
            <DialogTitle>{text.deleteTitle(entries.length, isolate(entries[0].name))}</DialogTitle>
            <DialogContent sx={contentSx}>
                <Typography variant="body2" color="text.secondary">
                    {text.deleteWarning(entries.length, hasFolders)}
                </Typography>
                {failure && (
                    <Typography variant="body2" color="error">
                        {failure}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button color="inherit" onClick={close}>
                    {text.cancel}
                </Button>
                <Button ref={confirmRef} variant="contained" color="error" loading={pending} onClick={confirm}>
                    {text.delete}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteDialog;
