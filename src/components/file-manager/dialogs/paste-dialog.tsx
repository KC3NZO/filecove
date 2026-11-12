import { useContext, useEffect, useMemo, useState } from "react";

import { DirectionContext } from "../../../contexts/direction-context";
import { useData, useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { isolate } from "../../../utils/bidi";
import { groupedEntries } from "../../../utils/groups";
import { folderOf } from "../../../utils/navigation";
import { replaceable } from "../../../utils/permissions";
import { entryClashes, mergedFolders } from "../../../utils/transfer";
import Button from "../../ui/button";
import Dialog, { DialogActions, DialogContent, DialogTitle } from "../../ui/dialog";
import { ConflictChoices, ConflictMessage } from "./conflict-step";
import { fmClasses } from "../../../styles/classes";
import styles from "./paste-dialog.module.css";

import type { Clash, Clipboard, ConflictPolicy, EntryClash, FileEntry, FolderRef, Section } from "../../../types";

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
     * already has, the entries to skip, which clash, and after a "replace", the ids of the folders
     * entries are merged into, which may change all the way down. The adapter then moves or copies
     * them in the background.
     */
    onStart: (request: PasteRequest, conflict: ConflictPolicy, skipped: FileEntry[], mergedIds: string[]) => void;
}

const NO_CLASHES: EntryClash[] = [];
const NO_NAMES: Clash[] = [];

/**
 * Pastes what was cut or copied, or dropped onto a folder: once the folder's names are checked, the
 * adapter moves or copies it in the background, shown in the transfer panel. Most pastes need
 * nothing from the user, so the check runs unseen and the dialog only shows to ask about names the
 * folder already has, or that entries from several folders share: replace or merge, keep both, or
 * skip.
 */
const PasteDialog = ({ open, request, onClose, onStart }: PasteDialogProps) => {
    const { clipboard, section, trail } = request;
    const kind = clipboard.kind === "cut" ? "move" : "copy";
    const target = folderOf(section, trail);
    const entries = groupedEntries(clipboard.parts);
    const { store, adapter: defaultAdapter } = useData();
    const adapter = section.adapter ?? defaultAdapter;
    // Entries already in the target clash with themselves: a copy keeps both, and a move leaves them.
    // Another adapter's are never there, as ids only name its own folders.
    const incoming = groupedEntries(
        clipboard.parts.filter(
            (part) => part.adapter !== adapter || folderOf(part.section, part.trail).id !== target.id,
        ),
    );
    const { text } = useLocale();
    const dir = useContext(DirectionContext);

    // The target is listed first when it isn't cached, as a folder dropped onto may never have been
    // opened, and its clashes are only looked for once all its pages have come.
    const { state } = useFolder(section, target.id, true);
    const listed = (!!state?.entries && !state.partial) || state?.status === "error";
    // Whether an entry the folder has can be replaced or merged into, as its permissions say.
    const changes = (entry: FileEntry) => replaceable(store, section, entry);

    const [checked, setChecked] = useState(false);
    const [conflicts, setConflicts] = useState<EntryClash[] | null>(null);
    const clashes = useMemo(() => conflicts?.map(({ clash }) => clash) ?? NO_NAMES, [conflicts]);

    // Folders a Replace or Merge merges others into are listed again all the way down once it ends.
    // The dialog closes as the paste starts, so a second click while it fades out starts nothing.
    const paste = (conflict: ConflictPolicy, found: EntryClash[]) => {
        if (open) {
            onStart(
                request,
                conflict,
                conflict === "skip" ? found.map(({ entry }) => entry) : [],
                conflict === "replace" ? mergedFolders(incoming, state?.entries, changes) : [],
            );
        }
    };

    // Once the target's listing is there, it's checked for names the entries share, and with nothing
    // to ask, the paste starts. Copying into the entries' own folder clashes with every one of them,
    // and only makes sense as a duplicate, so it keeps both without asking, and entries of a search's
    // results already there aren't asked about either. Each paste mounts a new dialog, so this runs
    // once per paste.
    useEffect(() => {
        if (checked || !listed) {
            return;
        }

        const found = entryClashes(incoming, state?.entries, changes);

        setChecked(true);

        if (found.length > 0) {
            setConflicts(found);
        } else {
            paste("keepBoth", NO_CLASHES);
        }
    }, [checked, listed]);

    const title = (kind === "move" ? text.moveTitle : text.copyTitle)(entries.length, isolate(entries[0].name));

    return (
        <Dialog dir={dir} open={open && !!conflicts} fullWidth maxWidth="xs" className={fmClasses.pasteDialog} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent className={styles.content}>
                {conflicts && <ConflictMessage clashes={clashes} folderName={target.name} />}
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={onClose}>
                    {text.cancel}
                </Button>
                <div className={styles.spacer} />
                {conflicts && (
                    <ConflictChoices
                        clashes={clashes}
                        pending={null}
                        onChoose={(conflict) => paste(conflict, conflicts)}
                    />
                )}
            </DialogActions>
        </Dialog>
    );
};

export default PasteDialog;
