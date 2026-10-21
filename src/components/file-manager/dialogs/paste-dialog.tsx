import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFolder } from "../../../hooks/use-folder";
import { clashingNames, useTransfer } from "../../../hooks/use-transfer";
import { dialogPaperSx } from "../../../styles/mixins";
import { folderOf } from "../../../utils/navigation";
import { ConflictChoices, ConflictMessage } from "./conflict-step";

import type { Clipboard, ConflictPolicy, FileAdapter, FolderRef, Section } from "../../../types";

export interface PasteRequest {
    /** What is pasted, as it was when the paste began: the clipboard, or entries dropped onto a folder. */
    clipboard: Clipboard;
    /** The section of the folder pasted into. */
    section: Section;
    /** Trail to the folder pasted into. */
    trail: FolderRef[];
}

export interface PasteDialogState {
    /** False once the paste is over, or while the dialog plays its closing transition. */
    open: boolean;
    /** Counts pastes, so each one starts afresh. */
    id: number;
    request: PasteRequest;
}

interface PasteDialogProps {
    open: boolean;
    request: PasteRequest;
    onClose: () => void;
    /**
     * Called whenever the adapter may have changed folders, done, failed or cancelled, with their
     * ids, to list them again wherever they're shown.
     */
    onChanged: (adapter: FileAdapter, folderIds: string[]) => void;
    /** Called once the adapter has moved or copied the entries. */
    onDone: (request: PasteRequest) => void;
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
 * Pastes what was cut or copied, or dropped onto a folder: the adapter moves or copies it into the
 * folder. Most pastes need nothing from the user, so they run unseen and the dialog only shows to
 * ask about names the folder already has (replace, keep both or skip) or to report the adapter's error.
 */
const PasteDialog = ({ open, request, onClose, onChanged, onDone }: PasteDialogProps) => {
    const { clipboard, section, trail } = request;
    const { entries } = clipboard;
    const kind = clipboard.kind === "cut" ? "move" : "copy";
    const target = folderOf(section, trail);
    const sourceId = folderOf(clipboard.section, clipboard.trail).id;

    // The target is listed first when it isn't cached, as a folder dropped onto may never have been
    // opened, and its clashes are only looked for once all its pages have come.
    const { state } = useFolder(section, target.id, true);
    const listed = (!!state?.entries && !state.partial) || state?.status === "error";

    const [checked, setChecked] = useState(false);
    const [conflicts, setConflicts] = useState<string[] | null>(null);

    // The adapter can't undo a change it has made, so however it ended, the target is listed again,
    // and so is the source after a move.
    const refresh = () => onChanged(clipboard.adapter, kind === "move" ? [target.id, sourceId] : [target.id]);

    const { pending, failure, run, cancel } = useTransfer({ kind, adapter: clipboard.adapter, entries }, refresh);

    const paste = (conflict: ConflictPolicy) => {
        run(target.id, conflict).then((outcome) => {
            if (outcome === "done") {
                onDone(request);
            } else if (outcome === "failed") {
                setConflicts(null);
            }
        });
    };

    // Once the target's listing is there, it's checked for names the entries share, and with nothing
    // to ask, the paste starts. Copying into the entries' own folder clashes with every one of them,
    // and only makes sense as a duplicate, so it keeps both without asking. Each paste mounts a new
    // dialog, so this runs once per paste.
    useEffect(() => {
        if (checked || !listed) {
            return;
        }

        const clashes = target.id === sourceId ? [] : clashingNames(entries, state?.entries);

        setChecked(true);

        if (clashes.length > 0) {
            setConflicts(clashes);
        } else {
            paste("keepBoth");
        }
    }, [checked, listed]);

    const close = () => {
        cancel();
        onClose();
    };

    const what = entries.length === 1 ? `“${entries[0].name}”` : `${entries.length} items`;
    const title = failure ? `Couldn't ${kind} ${what}` : `${kind === "move" ? "Move" : "Copy"} ${what}`;

    return (
        <Dialog open={open && (!!conflicts || !!failure)} fullWidth maxWidth="xs" slotProps={slotProps} onClose={close}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={contentSx}>
                {failure ? (
                    <Typography variant="body2" color="error">
                        {failure}
                    </Typography>
                ) : (
                    conflicts && <ConflictMessage names={conflicts} folderName={target.name} />
                )}
            </DialogContent>
            {failure ? (
                <DialogActions>
                    <Button variant="contained" onClick={close}>
                        Close
                    </Button>
                </DialogActions>
            ) : (
                <DialogActions>
                    <Button color="inherit" disabled={!!pending} onClick={close}>
                        Cancel
                    </Button>
                    <Box sx={spacerSx} />
                    <ConflictChoices pending={pending} onChoose={paste} />
                </DialogActions>
            )}
        </Dialog>
    );
};

export default PasteDialog;
