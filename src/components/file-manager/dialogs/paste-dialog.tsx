import { useContext, useEffect, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useData, useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { dialogActionsSx } from "../../../styles/direction";
import { dialogPaperSx } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import { folderOf } from "../../../utils/navigation";
import { replaceable } from "../../../utils/permissions";
import { findClashes, mergedFolders } from "../../../utils/transfer";
import { ConflictChoices, ConflictMessage } from "./conflict-step";

import type { Clash, Clipboard, ConflictPolicy, FileEntry, FolderRef, Section } from "../../../types";

export interface PasteRequest {
    /** What is pasted, as it was when the paste began: the clipboard, or entries dropped onto a folder. */
    clipboard: Clipboard;
    /** The section of the folder pasted into. */
    section: Section;
    /** Trail to the folder pasted into. */
    trail: FolderRef[];
    /** The failed copy or move this tries again, by its id in the transfer queue, which goes as this one starts. */
    retrying?: number;
}

export interface PasteDialogState {
    /** False once the paste has started, or while the dialog plays its closing transition. */
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
     * Called once there's nothing left to ask, with the choice that settles names the folder
     * already has, the names of the entries to skip, as the folder had them, and after a
     * "replace", the ids of the folders entries are merged into, which may change all the way
     * down. The adapter then moves or copies them in the background.
     */
    onStart: (request: PasteRequest, conflict: ConflictPolicy, skipped: string[], mergedIds: string[]) => void;
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

const NO_CLASHES: Clash[] = [];

/**
 * Pastes what was cut or copied, or dropped onto a folder: once the folder's names are checked, the
 * adapter moves or copies it in the background, shown in the transfer panel. Most pastes need
 * nothing from the user, so the check runs unseen and the dialog only shows to ask about names the
 * folder already has: replace or merge, keep both, or skip.
 */
const PasteDialog = ({ open, request, onClose, onStart }: PasteDialogProps) => {
    const { clipboard, section, trail } = request;
    const { entries } = clipboard;
    const kind = clipboard.kind === "cut" ? "move" : "copy";
    const target = folderOf(section, trail);
    const sourceId = folderOf(clipboard.section, clipboard.trail).id;
    const { text } = useLocale();
    const dir = useContext(DirectionContext);

    // The target is listed first when it isn't cached, as a folder dropped onto may never have been
    // opened, and its clashes are only looked for once all its pages have come.
    const { state } = useFolder(section, target.id, true);
    const listed = (!!state?.entries && !state.partial) || state?.status === "error";
    const { store } = useData();
    // Whether an entry the folder has can be replaced or merged into, as its permissions say.
    const changes = (entry: FileEntry) => replaceable(store, section, entry);

    const [checked, setChecked] = useState(false);
    const [conflicts, setConflicts] = useState<Clash[] | null>(null);

    // Folders a Replace or Merge merges others into are listed again all the way down once it ends.
    // The dialog closes as the paste starts, so a second click while it fades out starts nothing.
    const paste = (conflict: ConflictPolicy, clashes: Clash[]) => {
        if (open) {
            onStart(
                request,
                conflict,
                conflict === "skip" ? clashes.map((clash) => clash.name) : [],
                conflict === "replace" ? mergedFolders(entries, state?.entries, changes) : [],
            );
        }
    };

    // Once the target's listing is there, it's checked for names the entries share, and with nothing
    // to ask, the paste starts. Copying into the entries' own folder clashes with every one of them,
    // and only makes sense as a duplicate, so it keeps both without asking. Each paste mounts a new
    // dialog, so this runs once per paste.
    useEffect(() => {
        if (checked || !listed) {
            return;
        }

        const clashes = target.id === sourceId ? [] : findClashes(entries, state?.entries, changes);

        setChecked(true);

        if (clashes.length > 0) {
            setConflicts(clashes);
        } else {
            paste("keepBoth", NO_CLASHES);
        }
    }, [checked, listed]);

    const title = (kind === "move" ? text.moveTitle : text.copyTitle)(entries.length, isolate(entries[0].name));

    return (
        <Dialog dir={dir} open={open && !!conflicts} fullWidth maxWidth="xs" slotProps={slotProps} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={contentSx}>
                {conflicts && <ConflictMessage clashes={conflicts} folderName={target.name} />}
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button color="inherit" onClick={onClose}>
                    {text.cancel}
                </Button>
                <Box sx={spacerSx} />
                {conflicts && (
                    <ConflictChoices
                        clashes={conflicts}
                        pending={null}
                        onChoose={(conflict) => paste(conflict, conflicts)}
                    />
                )}
            </DialogActions>
        </Dialog>
    );
};

export default PasteDialog;
