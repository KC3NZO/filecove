import { useContext, useEffect, useMemo, useState } from "react";

import { DirectionContext } from "../../../contexts/direction-context";
import { useData } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { listingOf } from "../../../store/folder-store";
import { isolate } from "../../../utils/bidi";
import { folderOf } from "../../../utils/navigation";
import { replaceable } from "../../../utils/permissions";
import { entryClashes, mergedFolders } from "../../../utils/transfer";
import Button from "../../ui/button";
import Dialog, { DialogActions, DialogContent, DialogTitle } from "../../ui/dialog";
import { ConflictChoices, ConflictMessage } from "./conflict-step";
import { fmClasses } from "../../../styles/classes";
import styles from "./restore-dialog.module.css";

import type { Clash, ConflictPolicy, EntryClash, FileAdapter, FileEntry, Section, UndoFolder } from "../../../types";

export interface RestoreRequest {
    /** The trash the entries are in, right in its root. */
    section: Section;
    /** The trash's adapter, already known to restore. */
    adapter: FileAdapter;
    /** The entries, each with its `trashed`. */
    entries: FileEntry[];
    /**
     * The folder each of `entries` goes back to, by index, as a folder of a section, or null when
     * no section shows it, whose names can't be checked.
     */
    origins: (UndoFolder | null)[];
}

export interface RestoreDialogState {
    /** False once the restore has started, or while the dialog plays its closing transition. */
    open: boolean;
    /** Counts restores, so each one starts afresh. */
    id: number;
    request: RestoreRequest;
}

interface RestoreDialogProps {
    open: boolean;
    request: RestoreRequest;
    onClose: () => void;
    /**
     * Called once there's nothing left to ask, with the choice that settles names the folders
     * already have, the entries to skip, which clash, and after a "replace", the ids of the folders
     * entries are merged into, which may change all the way down. The adapter then restores them.
     */
    onStart: (request: RestoreRequest, conflict: ConflictPolicy, skipped: FileEntry[], mergedIds: string[]) => void;
}

/** The entries going back into one folder, and what it lists. */
interface Destination {
    to: UndoFolder;
    entries: FileEntry[];
    listed: FileEntry[] | undefined;
}

const NO_NAMES: Clash[] = [];

/**
 * Restores entries from the trash to the folders they were moved there from. Once those folders'
 * names are checked, the adapter puts them back. Most restores need nothing from the user, so the
 * check runs unseen and the dialog only shows to ask about names a folder has now, or that entries
 * going back to one folder share, as a paste does: replace or merge, keep both, or skip. A folder no
 * section shows, or that can't be listed, as it's gone, is left to the adapter.
 */
const RestoreDialog = ({ open, request, onClose, onStart }: RestoreDialogProps) => {
    const { adapter, entries, origins } = request;
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    const { store } = useData();

    const [destinations, setDestinations] = useState<Destination[] | null>(null);
    const [conflicts, setConflicts] = useState<EntryClash[] | null>(null);
    const clashes = useMemo(() => conflicts?.map(({ clash }) => clash) ?? NO_NAMES, [conflicts]);

    // Folders a Replace or Merge merges others into are listed again all the way down once it ends.
    // The dialog closes as the restore starts, so a second click while it fades out starts nothing.
    const restore = (conflict: ConflictPolicy, found: EntryClash[], checked: Destination[]) => {
        if (open) {
            onStart(
                request,
                conflict,
                conflict === "skip" ? found.map(({ entry }) => entry) : [],
                conflict === "replace"
                    ? checked.flatMap(({ to, entries: going, listed }) =>
                          mergedFolders(going, listed, (entry) => replaceable(store, to.section, entry)),
                      )
                    : [],
            );
        }
    };

    // Each folder the entries go back to is listed, if it isn't cached, and looked through for the
    // names they have, once all of it has come; with nothing to ask, the restore starts. Each
    // restore mounts a new dialog, so this runs once per restore.
    useEffect(() => {
        const controller = new AbortController();
        const byFolder = new Map<string, Destination>();

        entries.forEach((entry, index) => {
            const to = origins[index];

            if (!to) {
                return;
            }

            const key = `${to.section.id}/${folderOf(to.section, to.trail).id}`;
            const there = byFolder.get(key) ?? { to, entries: [], listed: undefined };

            there.entries.push(entry);
            byFolder.set(key, there);
        });

        void Promise.all(
            [...byFolder.values()].map(async (destination): Promise<Destination> => {
                const { to } = destination;
                const listed = await listingOf(
                    store,
                    to.section.id,
                    adapter,
                    folderOf(to.section, to.trail).id,
                    false,
                    controller.signal,
                ).catch(() => undefined);

                return { ...destination, listed };
            }),
        ).then((checked) => {
            if (controller.signal.aborted) {
                return;
            }

            const found = checked.flatMap(({ to, entries: going, listed }) =>
                entryClashes(going, listed, (entry) => replaceable(store, to.section, entry)),
            );

            setDestinations(checked);

            if (found.length > 0) {
                setConflicts(found);
            } else {
                restore("keepBoth", [], checked);
            }
        });

        return () => controller.abort();
    }, []);

    // The folder the names clash in, when it's one.
    const clashing = destinations?.filter(({ entries: going }) =>
        conflicts?.some(({ entry }) => going.includes(entry)),
    );
    const folderName =
        clashing?.length === 1 ? folderOf(clashing[0].to.section, clashing[0].to.trail).name : null;
    const title = text.restoreTitle(entries.length, isolate(entries[0].name));

    return (
        <Dialog dir={dir} open={open && !!conflicts} fullWidth maxWidth="xs" className={fmClasses.restoreDialog} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent className={styles.content}>
                {conflicts && <ConflictMessage clashes={clashes} folderName={folderName} />}
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={onClose}>
                    {text.cancel}
                </Button>
                <div className={styles.spacer} />
                {conflicts && destinations && (
                    <ConflictChoices
                        clashes={clashes}
                        pending={null}
                        onChoose={(conflict) => restore(conflict, conflicts, destinations)}
                    />
                )}
            </DialogActions>
        </Dialog>
    );
};

export default RestoreDialog;
