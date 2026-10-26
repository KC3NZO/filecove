import { useContext, useEffect, useMemo, useRef, useState } from "react";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useData } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { listingOf } from "../../../store/folder-store";
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
    /** Set when they're the copies a copy made, which undoing it deletes, as the dialog then says. */
    undoesCopy?: boolean;
    /**
     * Set to empty the trash, its root being the one group's folder: what it lists is read afresh
     * as the user confirms, and deleted, whatever `entries` held when the dialog opened.
     */
    emptiesTrash?: boolean;
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
 * so nothing is deleted without asking, not even the copies undoing a copy deletes, nor what's in
 * the trash as it's emptied. Anything the adapter rejects with is shown in the dialog, which stays
 * open to try again, with only the folders' entries not yet deleted.
 */
const DeleteDialog = ({ open, request, onClose, onChanged, onDone }: DeleteDialogProps) => {
    const { groups: asked, emptiesTrash } = request;
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    const { store } = useData();
    // Emptying the trash deletes what it lists as the user confirms.
    const [groups, setGroups] = useState(asked);
    const entries = groupedEntries(groups);

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

    // The trash's listing as it is now, so nothing moved there since the dialog opened is left, and
    // nothing restored meanwhile is deleted.
    const listTrash = async (signal: AbortSignal) => {
        const [trash] = asked;
        const listed = await listingOf(store, trash.section.id, trash.adapter, trash.section.rootId, true, signal);
        const now = [{ ...trash, entries: listed }];

        if (!signal.aborted) {
            setGroups(now);
        }

        return now;
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
        const deleteGroups = async () => {
            const given = emptiesTrash ? await listTrash(current.signal) : groups;
            const left = given.filter((group) => !deleted.current.includes(group) && group.entries.length > 0);

            for (const group of left) {
                if (current.signal.aborted) {
                    return given;
                }

                if (!group.adapter.delete) {
                    throw new Error("Not supported here.");
                }

                await group.adapter.delete(group.entries, { signal: current.signal });

                if (!current.signal.aborted) {
                    deleted.current = [...deleted.current, group];
                }
            }

            return given;
        };

        Promise.resolve()
            .then(deleteGroups)
            .then(
                (given) => {
                    if (!current.signal.aborted) {
                        controller.current = null;
                        refresh();
                        onDone({ ...request, groups: given });
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
                                : emptiesTrash
                                  ? text.emptyTrashFailed
                                  : text.deleteFailed(entries.length - groupedEntries(deleted.current).length),
                        );
                    }
                },
            );
    };

    const hasFolders = entries.some((entry) => entry.kind === "folder");
    const [first] = asked;
    let title: string;
    let warning: string;

    if (emptiesTrash) {
        title = text.emptyTrashTitle;
        warning = text.emptyTrashWarning;
    } else if (request.undoesCopy) {
        title = text.undoCopyTitle(entries.length, isolate(entries[0].name));
        warning = text.undoCopyWarning(entries.length, isolate(folderOf(first.section, first.trail).name));
    } else {
        title = text.deleteTitle(entries.length, isolate(entries[0].name));
        warning = text.deleteWarning(entries.length, hasFolders);
    }

    return (
        <Dialog dir={dir} open={open} fullWidth maxWidth="xs" slotProps={slotProps} onClose={close}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={contentSx}>
                <Typography variant="body2" color="text.secondary">
                    {warning}
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
                    {emptiesTrash ? text.emptyTrash : text.delete}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DeleteDialog;
