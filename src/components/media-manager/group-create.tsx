import { useEffect, useId, useRef, useState } from "react";

import { useFormSend } from "../../hooks/use-form-send";
import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import Button from "../ui/button";
import Text from "../ui/text";
import TextField from "../ui/text-field";
import styles from "./group-create.module.css";
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
        <div
            role="group"
            aria-labelledby={labelId}
            aria-busy={sending}
            className={styles.root}
            onKeyDown={(event) => {
                if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel();
                }
            }}
        >
            <div className={styles.name}>
                <Text id={labelId} component="label" htmlFor={fieldId} className={styles.label}>
                    {text.mediaGroupName}
                </Text>
                <TextField
                    id={fieldId}
                    size="small"
                    fullWidth
                    value={name}
                    error={!!problem}
                    helperText={problem}
                    inputRef={inputRef}
                    inputProps={{ readOnly: sending, autoComplete: "off", dir: "auto" }}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            create();
                        }
                    }}
                />
                {failure && trimmed === sentName && <FormFailure message={failure} />}
            </div>
            <div className={styles.buttons}>
                <Button color="inherit" onClick={onCancel}>
                    {text.cancel}
                </Button>
                <StepSend held={held} describedBy={undefined} onClick={create}>
                    {text.create}
                </StepSend>
            </div>
        </div>
    );
};

export default GroupCreate;
