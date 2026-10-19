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

import type { Clipboard, ConflictPolicy, FolderRef, Section } from "../../../types";

export interface PasteRequest {
    /** What is pasted, as it was when the paste began. */
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
 * Pastes what was cut or copied: the adapter moves or copies it into the folder. Most pastes need
 * nothing from the user, so they run unseen and the dialog only shows to ask about names the folder
 * already has (replace, keep both or skip) or to report the adapter's error.
 */
const PasteDialog = ({ open, request, onClose, onDone }: PasteDialogProps) => {
    const { clipboard, section, trail } = request;
    const { entries } = clipboard;
    const kind = clipboard.kind === "cut" ? "move" : "copy";
    const target = folderOf(section, trail);
    const sourceId = folderOf(clipboard.section, clipboard.trail).id;

    const { state, reload } = useFolder(section, target.id, false);
    const parent = useFolder(section, folderOf(section, trail.slice(0, -1)).id, false);
    const source = useFolder(clipboard.section, sourceId, false);

    // Checked against the folder's cached listing as it is now. Copying into the entries' own folder
    // clashes with every one of them, and only makes sense as a duplicate, so it keeps both without asking.
    const [conflicts, setConflicts] = useState<string[] | null>(() => {
        const clashes = clashingNames(entries, state?.entries);

        return clashes.length > 0 && target.id !== sourceId ? clashes : null;
    });

    // The adapter can't undo a change it has made, so both folders are listed again however it
    // ended, and so is the target's parent when cached, for its item count.
    const refresh = () => {
        reload();

        if (trail.length > 0 && parent.state) {
            parent.reload();
        }

        if (kind === "move") {
            source.reload();
        }
    };

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

    // With nothing to ask, the paste starts as soon as it is requested. Each paste mounts a new
    // dialog, so this runs once per paste.
    useEffect(() => {
        if (!conflicts) {
            paste("keepBoth");
        }
    }, []);

    const close = () => {
        cancel();
        onClose();
    };

    const what = entries.length === 1 ? `“${entries[0].name}”` : `${entries.length} items`;

    return (
        <Dialog open={open && (!!conflicts || !!failure)} fullWidth maxWidth="xs" slotProps={slotProps} onClose={close}>
            <DialogTitle>{failure ? "Couldn't paste" : `Paste ${what}`}</DialogTitle>
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
