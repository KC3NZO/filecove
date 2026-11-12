import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { DirectionContext } from "../../../contexts/direction-context";
import { useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { isolate } from "../../../utils/bidi";
import { nameProblem, newFolderName, stemLength } from "../../../utils/names";
import { folderOf } from "../../../utils/navigation";
import Button from "../../ui/button";
import Dialog, { DialogActions, DialogContent, DialogTitle } from "../../ui/dialog";
import TextField from "../../ui/text-field";
import { fmClasses } from "../../../styles/classes";
import styles from "./name-dialog.module.css";

import type { FileAdapter, FileEntry, FolderRef, Section } from "../../../types";

interface RequestBase {
    section: Section;
    /** The section's adapter, already known to support the request. */
    adapter: FileAdapter;
    /** Trail to the folder the entry is created or renamed in. */
    trail: FolderRef[];
}

/** What the dialog asks a name for: a new folder, or an existing entry. */
export type NameRequest = (RequestBase & { kind: "create" }) | (RequestBase & { kind: "rename"; entry: FileEntry });

export interface NameDialogState {
    /** False while the dialog plays its closing transition; the rest is kept so it doesn't empty mid-fade. */
    open: boolean;
    /** Counts requests, so each one starts with a fresh form. */
    id: number;
    request: NameRequest;
}

interface NameDialogProps {
    open: boolean;
    request: NameRequest;
    onClose: () => void;
    /**
     * Called whenever the adapter may have changed folders, done, failed or cancelled, with their
     * ids, to list them again wherever they're shown.
     */
    onChanged: (adapter: FileAdapter, folderIds: string[]) => void;
    /** Called with the entry as the adapter returned it, once created or renamed. */
    onDone: (request: NameRequest, entry: FileEntry) => void;
}

const run = (request: NameRequest, parentId: string, name: string, signal: AbortSignal) => {
    const { adapter } = request;

    if (request.kind === "create" && adapter.createFolder) {
        return adapter.createFolder(parentId, name, { signal });
    }

    if (request.kind === "rename" && adapter.rename) {
        return adapter.rename(request.entry, name, { signal });
    }

    throw new Error("Not supported here.");
};

/**
 * Asks for the name of a new folder, or a new name for an entry, then has the adapter make the
 * change. Names are checked as they are typed against the folder's cached listing, and anything
 * the adapter rejects is shown under the field, with the name kept.
 */
const NameDialog = ({ open, request, onClose, onChanged, onDone }: NameDialogProps) => {
    const { section, trail } = request;
    const entry = request.kind === "rename" ? request.entry : undefined;
    const kind = entry?.kind ?? "folder";
    const parent = folderOf(section, trail);

    const formId = useId();
    const { state } = useFolder(section, parent.id, true);
    const { text } = useLocale();
    const dir = useContext(DirectionContext);

    // Null until something is typed, while a new folder's name is the one suggested: the first
    // unused one, which follows the listing as it comes, since a folder made in from its own menu
    // may never have been listed.
    const [typed, setTyped] = useState<string | null>(entry?.name ?? null);
    const name = typed ?? newFolderName(state?.entries, text);
    const [failure, setFailure] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => () => controller.current?.abort(), []);

    const trimmed = name.trim();
    const { adapter } = request;
    // The backend's own rules, which an unchanged name is left out of, since it has that name already.
    const check =
        adapter.checkName && trimmed !== entry?.name
            ? (candidate: string) => adapter.checkName?.(candidate, { kind, parentId: parent.id, entry })
            : undefined;
    const problem = trimmed
        ? nameProblem(trimmed, kind, state?.entries, text, { selfId: entry?.id, check })
        : undefined;
    // A new folder's name is checked against all of the folder, so it waits for the whole listing,
    // unless that failed, when the adapter has the say. A renamed entry's folder is listed already.
    const waiting = !entry && state?.status !== "error" && (!state?.entries || !!state.partial);
    const message = problem ?? failure;

    // Read-only rather than disabled while the adapter works, so the field keeps focus. The name
    // runs the way its own letters do (`dir="auto"`), so ".bashrc" keeps its dot in front right to left.
    const fieldProps = useMemo(
        () => ({ readOnly: pending, spellCheck: false, autoComplete: "off", dir: "auto" }),
        [pending],
    );

    // The field is focused with the name selected (a file's up to its extension), so typing
    // replaces it. This waits until the dialog has faded in: the context menu hands focus back to
    // where it was opened from as it closes, which would win over anything sooner.
    const handleEntered = () => {
        const input = inputRef.current;

        if (input) {
            input.focus();
            input.setSelectionRange(0, entry ? stemLength(entry.name, entry.kind) : input.value.length);
        }
    };

    // A suggested name that changes while the field has the focus is selected again, so typing
    // still replaces it.
    useEffect(() => {
        const input = inputRef.current;

        if (typed === null && input && document.activeElement === input) {
            input.select();
        }
    }, [typed, name]);

    const refresh = () => onChanged(adapter, [parent.id]);

    // Cancelling can't undo a change the backend has already made, so the folder is listed again.
    const close = () => {
        if (controller.current) {
            controller.current.abort();
            controller.current = null;
            refresh();
        }

        onClose();
    };

    const submit = (event: SubmitEvent) => {
        event.preventDefault();

        if (pending || waiting || !trimmed || problem) {
            return;
        }

        if (entry && trimmed === entry.name) {
            onClose();

            return;
        }

        const current = new AbortController();

        controller.current = current;
        // Kept as it is, so a suggested name doesn't move on to the next unused one as the folder
        // is listed again with the new one in it, while the dialog fades out.
        setTyped(name);
        setPending(true);
        setFailure(null);

        // Wrapped so an adapter that throws synchronously still ends up as a failure.
        Promise.resolve()
            .then(() => run(request, parent.id, trimmed, current.signal))
            .then(
                (result) => {
                    if (!current.signal.aborted) {
                        controller.current = null;
                        refresh();
                        onDone(request, result);
                    }
                },
                (error: unknown) => {
                    if (!current.signal.aborted) {
                        controller.current = null;
                        setPending(false);
                        setFailure(
                            error instanceof Error && error.message
                                ? isolate(error.message)
                                : entry
                                  ? text.renameFailed(kind)
                                  : text.createFailed,
                        );
                    }
                },
            );
    };

    return (
        <Dialog dir={dir} open={open} fullWidth maxWidth="xs" className={fmClasses.nameDialog} onClose={close} onEntered={handleEntered}>
            <DialogTitle>{entry ? text.renameTitle(kind) : text.newFolder}</DialogTitle>
            <DialogContent>
                <form id={formId} onSubmit={submit}>
                    <TextField
                        fullWidth
                        label={text.nameLabel(kind)}
                        value={name}
                        error={!!message}
                        // A blank line is kept while there is no message, so the dialog doesn't jump when one shows.
                        helperText={message ?? " "}
                        inputRef={inputRef}
                        inputProps={fieldProps}
                        className={styles.field}
                        onChange={(event) => {
                            setTyped(event.target.value);
                            setFailure(null);
                        }}
                    />
                </form>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={close}>
                    {text.cancel}
                </Button>
                <Button
                    type="submit"
                    form={formId}
                    variant="contained"
                    disabled={waiting || !trimmed || !!problem}
                    loading={pending}
                >
                    {entry ? text.rename : text.create}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NameDialog;
