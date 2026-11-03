import { useEffect, useId, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFormSend } from "../../hooks/use-form-send";
import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import { FormFailure } from "./media-form";
import { StepSend } from "./media-step";

import type { FileAdapter, FileEntry } from "../../types";

interface GroupCreateProps {
    adapter: FileAdapter;
    /** The root or group it's made in. */
    parentId: string;
    /** Closes it, asking nothing of the backend, or stopping what was asked. */
    onCancel: () => void;
    onCreated: (group: FileEntry) => void;
    /** Left while the backend was being asked, which may have made it by then. */
    onLeft: () => void;
}

// Above what the level holds, across it, as what's asked before deleting is in the asset view.
const rootSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 1,
    flexShrink: 0,
    px: 2,
    py: 1,
    borderBottom: 1,
    borderColor: "divider",
};

const nameSx: SxProps<Theme> = { flex: "1 1 14rem", minWidth: 0 };

const labelSx: SxProps<Theme> = { display: "block", mb: 0.5, fontSize: "0.8125rem", fontWeight: 700 };

// MUI aligns its helper text with `text-align: left`, which only its RTL plugin flips.
const fieldSx: SxProps<Theme> = { "& .MuiFormHelperText-root": { textAlign: "start" } };

const buttonsSx: SxProps<Theme> = { display: "flex", gap: 1, flexShrink: 0, marginInlineStart: "auto" };

/**
 * Asks a new group's name, in the library rather than in a dialog of its own, as a picker is often in
 * the app's own dialog already, and with no `form` element, as it may be in the app's form too. Only
 * the backend knows what a group's name may be, so only the adapter's `checkName` is asked as it's
 * typed, and its `createFolder` has the final say: a name refused stays, with why under it. It stays
 * until that answers, the field read-only rather than disabled, so it keeps the focus.
 */
const GroupCreate = ({ adapter, parentId, onCancel, onCreated, onLeft }: GroupCreateProps) => {
    const { text } = useLocale();
    const labelId = useId();
    const fieldId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [name, setName] = useState("");
    // The name last sent: why it was refused says nothing of another.
    const [sentName, setSentName] = useState("");
    const { sending, failure, send } = useFormSend(text.mediaCreateGroupFailed);
    const sendingRef = useRef(false);
    const onLeftRef = useRef(onLeft);
    const trimmed = name.trim();
    const refused = trimmed ? adapter.checkName?.(trimmed, { kind: "folder", parentId }) : undefined;
    const problem = refused ? isolate(refused) : undefined;
    const held = sending || !trimmed || !!problem;

    useEffect(() => inputRef.current?.focus(), []);

    useEffect(() => {
        sendingRef.current = sending;
        onLeftRef.current = onLeft;
    });

    // Going away stops what was asked (`useFormSend`), but the backend may have done it by then.
    useEffect(
        () => () => {
            if (sendingRef.current) {
                onLeftRef.current();
            }
        },
        [],
    );

    const create = () => {
        if (held) {
            return;
        }

        let made: FileEntry | undefined;

        setSentName(trimmed);
        send(
            async (signal) => {
                made = await adapter.createFolder?.(parentId, trimmed, { signal });
            },
            () => {
                sendingRef.current = false;

                if (made) {
                    onCreated(made);
                }
            },
        );
    };

    return (
        <Box
            role="group"
            aria-labelledby={labelId}
            aria-busy={sending}
            sx={rootSx}
            onKeyDown={(event) => {
                if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel();
                }
            }}
        >
            <Box sx={nameSx}>
                <Typography id={labelId} component="label" htmlFor={fieldId} sx={labelSx}>
                    {text.mediaGroupName}
                </Typography>
                <TextField
                    id={fieldId}
                    size="small"
                    fullWidth
                    value={name}
                    error={!!problem}
                    helperText={problem}
                    inputRef={inputRef}
                    slotProps={{ htmlInput: { readOnly: sending, autoComplete: "off", dir: "auto" } }}
                    sx={fieldSx}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            create();
                        }
                    }}
                />
                {failure && trimmed === sentName && <FormFailure message={failure} />}
            </Box>
            <Box sx={buttonsSx}>
                <Button color="inherit" onClick={onCancel}>
                    {text.cancel}
                </Button>
                <StepSend held={held} describedBy={undefined} onClick={create}>
                    {text.create}
                </StepSend>
            </Box>
        </Box>
    );
};

export default GroupCreate;
