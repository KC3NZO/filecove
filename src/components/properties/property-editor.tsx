import { useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { NO_ERRORS } from "../../utils/field-errors";
import { formatValue, sameValue } from "../../utils/property-value";
import PropertyInput from "./property-input";

import type { FileAdapter, FileEntry, PropertyDefinition, PropertyEditParams, PropertySave } from "../../types";
import type { PropertyInputHandle } from "./property-input";

interface PropertyEditorProps {
    definition: PropertyDefinition;
    /** The property's value, which editing starts from unless a save of it failed. */
    value: unknown;
    entry: FileEntry;
    adapter: FileAdapter;
    /** Its edit being saved, or that failed, kept by the cache, whose value it starts from. */
    save?: PropertySave;
    /** The element naming the property, its row's label. */
    labelId: string;
    /** Takes the focus as it mounts, opened by its Edit button rather than shown again after a failed save. */
    takeFocus: boolean;
    onSave: (value: unknown) => void;
    /** Leaves the property as it was, also as the value saved is what it was. */
    onCancel: () => void;
}

const editorSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    width: "100%",
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

// What a press or Enter acts on itself, which Enter doesn't save from.
const CONTROLS = "button, a, [role='button'], [role='radio'], [role='checkbox'], [role='option']";

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

// A press on the editor's buttons leaves the focus in its field, so it isn't taken as the focus
// leaving, which saves, first; Safari doesn't focus a button pressed.
const keepFocus = (event: MouseEvent) => event.preventDefault();

/** The first part of the editor to take the focus: its field, or else whatever of the app's takes it. */
const firstControl = (editor: HTMLElement) =>
    editor.querySelector<HTMLElement>("input:not([type='hidden']), textarea, select") ??
    editor.querySelector<HTMLElement>("[tabindex]:not([tabindex='-1']), button");

/**
 * A property being changed in the properties: by the app's own editor (`renderEdit`), or the
 * built-in one of its type (text, a number, a date, a select, chips), with Cancel and Save. Enter
 * saves (Ctrl+Enter or ⌘Enter over several lines), Escape cancels, and the focus leaving it saves
 * what changed, as a details panel on the web does. While it's saved it can't be changed, and
 * should that fail, the adapter's message shows under it, with what was given kept to try again.
 */
const PropertyEditor = ({
    definition,
    value,
    entry,
    adapter,
    save,
    labelId,
    takeFocus,
    onSave,
    onCancel,
}: PropertyEditorProps) => {
    const locale = useLocale();
    const { text } = locale;
    const [draft, setDraft] = useState<unknown>(save ? save.value : value);
    const editorRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<PropertyInputHandle>(null);
    const inputId = useId();
    const multiline =
        definition.type === "string" && !!definition.multiline && !definition.multiple && !definition.options;
    const saving = save?.status === "saving";
    const failure = save?.status === "error" ? save.error : undefined;

    // Only as it mounts, so the focus isn't taken back as it goes on being shown.
    const tookFocus = useRef(false);

    useEffect(() => {
        const control = editorRef.current && firstControl(editorRef.current);

        if (!takeFocus || tookFocus.current || !control) {
            return;
        }

        tookFocus.current = true;
        control.focus();

        // The caret at the end of what's there; a field of a type with no caret, a number or a
        // date, throws.
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
            try {
                control.setSelectionRange(control.value.length, control.value.length);
            } catch {
                // No caret to place.
            }
        }
    }, [takeFocus]);

    // The value to save: with anything typed in a list but not added yet, text trimmed.
    const current = () => {
        const next = inputRef.current ? inputRef.current.flush() : draft;

        return typeof next === "string" && definition.type === "string" ? next.trim() : next;
    };

    // Saves what changed, or closes when nothing did. The focus leaving it doesn't try again what
    // failed as it was, which only the user's Save does.
    const commit = (leaving: boolean) => {
        const next = current();

        if (sameValue(next, value)) {
            onCancel();
        } else if (!(leaving && failure !== undefined && save && sameValue(next, save.value))) {
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
            (!multiline || event.ctrlKey || event.metaKey) &&
            !(event.target instanceof Element && event.target.closest(CONTROLS))
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

    const params: PropertyEditParams = {
        definition,
        value: draft,
        formattedValue: formatValue(definition, draft, entry, locale),
        entry,
        adapter,
        labelId,
        errors: NO_ERRORS,
        id: inputId,
        onChange: (next) => setDraft(() => next),
        disabled: saving,
        error: failure !== undefined,
    };

    return (
        <Box ref={editorRef} sx={editorSx} onKeyDown={handleKeyDown} onBlur={handleBlur}>
            {definition.renderEdit ? (
                definition.renderEdit(params)
            ) : (
                <PropertyInput
                    definition={definition}
                    value={draft}
                    onChange={params.onChange}
                    id={inputId}
                    labelId={labelId}
                    disabled={saving}
                    error={failure !== undefined}
                    handle={inputRef}
                />
            )}
            {failure !== undefined && (
                <Typography role="alert" sx={errorSx}>
                    <bdi>{messageOf(failure) ?? text.propertiesSaveFailed(definition.label)}</bdi>
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
