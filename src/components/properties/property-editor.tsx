import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";

import type { EditableField, PropertySave } from "../../types";

type FieldValue = EditableField["value"];

interface PropertyEditorProps {
    field: EditableField;
    /** Its edit being saved, or that failed, kept by the cache, whose value it starts from. */
    save?: PropertySave;
    /** The element naming the field, its row's label. */
    labelId: string;
    /** Takes the focus as it mounts, opened by its Edit button rather than shown again after a failed save. */
    takeFocus: boolean;
    onSave: (value: FieldValue) => void;
    /** Leaves the field as it was, also as the value saved is what it was. */
    onCancel: () => void;
}

const editorSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    width: "100%",
};

const tagsSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    gap: 0.5,
    "&:empty": { display: "none" },
};

// A small chip's delete icon is spaced with a physical `margin-left` and `margin-right`, reset for
// logical ones (see `rtl.md`).
const chipSx: SxProps<Theme> = {
    "& .MuiChip-deleteIcon": { marginLeft: 0, marginRight: 0, marginInlineStart: "-4px", marginInlineEnd: "4px" },
};

const errorSx: SxProps<Theme> = {
    color: "error.main",
    fontSize: "0.75rem",
};

const buttonsSx: SxProps<Theme> = {
    display: "flex",
    justifyContent: "flex-end",
    gap: 1,
};

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

// A press on the editor's buttons and chips leaves the focus in its field, so it isn't taken as the
// focus leaving, which saves, first; Safari doesn't focus a button pressed.
const keepFocus = (event: MouseEvent) => event.preventDefault();

const sameValue = (a: FieldValue, b: FieldValue) =>
    typeof a === "string" || typeof b === "string"
        ? a === b
        : a.length === b.length && a.every((tag, index) => tag === b[index]);

/** Tags trimmed, each once, none empty, with what's typed after them. */
const tagsWith = (tags: readonly string[], typed = "") =>
    [...new Set([...tags, ...typed.split(",")].map((tag) => tag.trim()).filter(Boolean))];

/**
 * A field of the backend's own being changed in the properties: its text, on one line or several,
 * or its tags, removed by their chips and added as they're typed, with Cancel and Save. Enter saves
 * (Ctrl+Enter or ⌘Enter over several lines), Escape cancels, and the focus leaving it saves what
 * changed, as a details panel on the web does. While it's saved it can't be changed, and should
 * that fail, the adapter's message shows under it, with what was typed kept to try again.
 */
const PropertyEditor = ({ field, save, labelId, takeFocus, onSave, onCancel }: PropertyEditorProps) => {
    const { text } = useLocale();
    const [draft, setDraft] = useState<FieldValue>(save?.value ?? field.value);
    // What's typed for a tag not added yet.
    const [typed, setTyped] = useState("");
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const multiline = field.type === "text" && !!field.multiline;
    const saving = save?.status === "saving";
    const failure = save?.status === "error" ? save.error : undefined;

    // Only as it mounts, so the focus isn't taken back as the field goes on being shown.
    const tookFocus = useRef(false);

    useEffect(() => {
        const input = inputRef.current;

        if (takeFocus && !tookFocus.current && input) {
            tookFocus.current = true;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }, [takeFocus]);

    const value = (): FieldValue => (typeof draft === "string" ? draft.trim() : tagsWith(draft, typed));

    // Saves what changed, or closes when nothing did. The focus leaving it doesn't try again what
    // failed as it was, which only the user's Save does.
    const commit = (leaving: boolean) => {
        const next = value();

        if (sameValue(next, field.value)) {
            onCancel();
        } else if (!(leaving && failure !== undefined && save && sameValue(next, save.value))) {
            setTyped("");
            setDraft(next);
            onSave(next);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (saving || event.defaultPrevented) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
        } else if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.altKey &&
            (!multiline || event.ctrlKey || event.metaKey)
        ) {
            event.preventDefault();
            commit(false);
        }
    };

    // The focus going elsewhere, but not the window losing it, saves what changed.
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const to = event.relatedTarget;

        if (saving || (to instanceof Node && event.currentTarget.contains(to)) || !document.hasFocus()) {
            return;
        }

        commit(true);
    };

    const removeTag = (tag: string) => {
        if (typeof draft !== "string") {
            setDraft(draft.filter((each) => each !== tag));
            inputRef.current?.focus();
        }
    };

    // Enter or a comma adds what's typed as a tag; Enter with nothing typed saves.
    const handleTagKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (typeof draft === "string" || saving) {
            return;
        }

        if ((event.key === "Enter" && !event.ctrlKey && !event.metaKey && typed.trim()) || event.key === ",") {
            event.preventDefault();
            setDraft(tagsWith(draft, typed));
            setTyped("");
        } else if (event.key === "Backspace" && !typed && draft.length > 0) {
            event.preventDefault();
            setDraft(draft.slice(0, -1));
        }
    };

    return (
        <Box sx={editorSx} onKeyDown={handleKeyDown} onBlur={handleBlur}>
            {typeof draft === "string" ? (
                <TextField
                    fullWidth
                    size="small"
                    multiline={multiline}
                    minRows={multiline ? 2 : undefined}
                    maxRows={multiline ? 8 : undefined}
                    value={draft}
                    error={failure !== undefined}
                    inputRef={inputRef}
                    slotProps={{
                        htmlInput: {
                            "aria-labelledby": labelId,
                            maxLength: field.type === "text" ? field.maxLength : undefined,
                            readOnly: saving,
                            dir: "auto",
                        },
                    }}
                    onChange={(event) => setDraft(event.target.value)}
                />
            ) : (
                <>
                    <Box sx={tagsSx}>
                        {draft.map((tag) => (
                            <Chip
                                key={tag}
                                size="small"
                                label={<bdi>{tag}</bdi>}
                                aria-label={text.propertiesRemoveTag(isolate(tag))}
                                disabled={saving}
                                sx={chipSx}
                                onMouseDown={keepFocus}
                                onClick={() => removeTag(tag)}
                                onDelete={() => removeTag(tag)}
                            />
                        ))}
                    </Box>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder={text.propertiesAddTag}
                        value={typed}
                        error={failure !== undefined}
                        inputRef={inputRef}
                        slotProps={{
                            htmlInput: {
                                "aria-label": text.propertiesAddTag,
                                "aria-describedby": labelId,
                                readOnly: saving,
                                dir: "auto",
                            },
                        }}
                        onChange={(event) => setTyped(event.target.value)}
                        onKeyDown={handleTagKeyDown}
                    />
                </>
            )}
            {failure !== undefined && (
                <Typography role="alert" sx={errorSx}>
                    <bdi>{messageOf(failure) ?? text.propertiesSaveFailed(field.label)}</bdi>
                </Typography>
            )}
            <Box sx={buttonsSx}>
                <Button size="small" color="inherit" disabled={saving} onMouseDown={keepFocus} onClick={onCancel}>
                    {text.propertiesCancel}
                </Button>
                <Button
                    size="small"
                    variant="contained"
                    loading={saving}
                    onMouseDown={keepFocus}
                    onClick={() => commit(false)}
                >
                    {text.propertiesSave}
                </Button>
            </Box>
        </Box>
    );
};

export default PropertyEditor;
