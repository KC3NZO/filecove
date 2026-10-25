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
import { groupedEntries } from "../../../utils/groups";
import { folderOf } from "../../../utils/navigation";

import type { EntryGroup, FileAdapter } from "../../../types";

/** Entries of one folder to delete, with the adapter serving its section. */
export interface DeleteGroup extends EntryGroup {
    /** The section's adapter, already known to support deleting. */
    adapter: FileAdapter;
}

export interface DeleteRequest {
    /** The entries by the folder they're in: one, or several for a search's results, of one section or more. */
    groups: DeleteGroup[];
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
    /**
     * Called once the adapter has deleted the entries, or as the dialog closes when it had deleted
     * some folders' before failing, with only those.
     */
    onDone: (request: DeleteRequest) => void;
}

const contentSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
};

/**
 * Asks to confirm deleting entries, then has the adapter delete them, a folder's at a time, as it
 * takes entries sharing a folder, each through its own section's adapter. Deleting can't be undone,
 * so nothing is deleted without asking. Anything the adapter rejects with is shown in the dialog,
 * which stays open to try again, with only the folders' entries not yet deleted.
 */
const DeleteDialog = ({ open, request, onClose, onChanged, onDone }: DeleteDialogProps) => {
    const { groups } = request;
    const entries = groupedEntries(groups);
    const { text } = useLocale();
    const dir = useContext(DirectionContext);

    const [pending, setPending] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);
    // The groups deleted so far.
    const deleted = useRef<DeleteGroup[]>([]);

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

    // Each adapter's folders, listed again together.
    const refresh = () =>
        new Set(groups.map((group) => group.adapter)).forEach((served) =>
            onChanged(
                served,
                groups
                    .filter((group) => group.adapter === served)
                    .map((group) => folderOf(group.section, group.trail).id),
            ),
        );

    // Cancelling can't bring back what the backend has already deleted, so the folders are listed
    // again, and what was deleted before a failure is done with.
    const close = () => {
        if (controller.current) {
            controller.current.abort();
            controller.current = null;
            refresh();
        }

        if (deleted.current.length > 0) {
            onDone({ ...request, groups: deleted.current });
        } else {
            onClose();
        }
    };

    const confirm = () => {
        if (pending) {
            return;
        }

        const current = new AbortController();

        controller.current = current;
        setPending(true);
        setFailure(null);

        // One folder's entries after another, leaving out those deleted before a failure. Wrapped so
        // an adapter that throws synchronously still ends up as a failure.
        const left = groups.filter((group) => !deleted.current.includes(group));
        const deleteGroups = async () => {
            for (const group of left) {
                if (current.signal.aborted) {
                    return;
                }

                if (!group.adapter.delete) {
                    throw new Error("Not supported here.");
                }

                await group.adapter.delete(group.entries, { signal: current.signal });

                if (!current.signal.aborted) {
                    deleted.current = [...deleted.current, group];
                }
            }
        };

        Promise.resolve()
            .then(deleteGroups)
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
                                : text.deleteFailed(entries.length - groupedEntries(deleted.current).length),
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
