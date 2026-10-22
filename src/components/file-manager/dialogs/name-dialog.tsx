import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { dialogActionsSx } from "../../../styles/direction";
import { dialogPaperSx } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import { nameProblem, newFolderName, stemLength } from "../../../utils/names";
import { folderOf } from "../../../utils/navigation";

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

// Outlined labels sit on the field's top edge, so the field needs room below the title.
//
// MUI places that label with `left`, a pixel shift and `transform-origin: top left`, and aligns the
// border's notch and the error text with `text-align: left`. Only its RTL plugin flips those, so on
// a page that sets just `dir` they would sit on the wrong side. Here they're placed logically, with
// the shift and the origin as custom properties of lengths and percentages, since the plugin would
// swap a `left` or `right` written in a custom property's value.
const fieldSx: SxProps<Theme> = {
    mt: 1,
    "--label-shift": "14px",
    "--label-origin": "0%",
    "&:dir(rtl)": { "--label-shift": "-14px", "--label-origin": "100%" },
    "& .MuiInputLabel-root": {
        left: "auto",
        insetInlineStart: 0,
        transformOrigin: "var(--label-origin) top",
        transform: "translate(var(--label-shift), 16px) scale(1)",
    },
    "& .MuiInputLabel-root.MuiInputLabel-shrink": {
        transform: "translate(var(--label-shift), -9px) scale(0.75)",
    },
    "& fieldset, & .MuiFormHelperText-root": { textAlign: "start" },
};

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

    const [name, setName] = useState(() => entry?.name ?? newFolderName(state?.entries, text));
    const [failure, setFailure] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => () => controller.current?.abort(), []);

    const trimmed = name.trim();
    const problem = trimmed ? nameProblem(trimmed, kind, state?.entries, text, entry?.id) : undefined;
    const message = problem ?? failure;

    // Read-only rather than disabled while the adapter works, so the field keeps focus. The name
    // runs the way its own letters do (`dir="auto"`), so ".bashrc" keeps its dot in front right to left.
    const fieldSlotProps = useMemo(
        () => ({ htmlInput: { readOnly: pending, spellCheck: false, autoComplete: "off", dir: "auto" } }),
        [pending],
    );

    // The field is focused with the name selected (a file's up to its extension), so typing
    // replaces it. This waits until the dialog has faded in: the context menu hands focus back to
    // where it was opened from as it closes, which would win over `autoFocus`.
    const slotProps = useMemo(
        () => ({
            paper: { sx: dialogPaperSx },
            transition: {
                onEntered: () => {
                    const input = inputRef.current;

                    if (input) {
                        input.focus();
                        input.setSelectionRange(0, entry ? stemLength(entry.name, entry.kind) : input.value.length);
                    }
                },
            },
        }),
        [entry],
    );

    const refresh = () => onChanged(request.adapter, [parent.id]);

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

        if (pending || !trimmed || problem) {
            return;
        }

        if (entry && trimmed === entry.name) {
            onClose();

            return;
        }

        const current = new AbortController();

        controller.current = current;
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
        <Dialog dir={dir} open={open} fullWidth maxWidth="xs" slotProps={slotProps} onClose={close}>
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
                        slotProps={fieldSlotProps}
                        sx={fieldSx}
                        onChange={(event) => {
                            setName(event.target.value);
                            setFailure(null);
                        }}
                    />
                </form>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button color="inherit" onClick={close}>
                    {text.cancel}
                </Button>
                <Button type="submit" form={formId} variant="contained" disabled={!trimmed || !!problem} loading={pending}>
                    {entry ? text.rename : text.create}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NameDialog;
