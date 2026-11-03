import { useEffect, useId, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFormSend } from "../../hooks/use-form-send";
import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import { refusalOf } from "../../utils/field-errors";
import { FormFailure, MediaFormBody } from "./media-form";
import MediaStep, { StepSend } from "./media-step";

import type { FileAdapter, FileEntry, MediaGroupForm, MediaSection } from "../../types";

interface MediaGroupProps {
    /** The group being edited, as it's listed now, or `null` for one being made. */
    group: FileEntry | null;
    /** The group it's in, `null` at the library's root. */
    parent: FileEntry | null;
    /** The id of the root or group it's made in. */
    parentId: string;
    section: MediaSection;
    /** The library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    form: MediaGroupForm;
    /** What its back button goes to. */
    backLabel: string;
    onCancel: () => void;
    /** The backend said yes, with the group as it now is when it says. */
    onDone: (group: FileEntry | undefined) => void;
    /** Left while the backend was being asked, which may have done it by then. */
    onLeft: () => void;
}

const stateSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    py: 3,
    color: "text.secondary",
    fontSize: "0.875rem",
    textAlign: "center",
};

/**
 * The step making or editing a group, in the library's place: the library's group form, which holds
 * what it likes, under the app's own keys, as the media manager never reads them. Editing, its `load`
 * brings what it starts from first, with Try again should that fail. What it holds goes to the adapter's
 * `createGroup` or `updateGroup`, and it stays until that's answered, to say why when it's refused, over
 * the form and under the fields it names.
 */
const MediaGroup = ({
    group,
    parent,
    parentId,
    section,
    adapter,
    form,
    backLabel,
    onCancel,
    onDone,
    onLeft,
}: MediaGroupProps) => {
    const { text } = useLocale();
    const noteId = useId();
    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...form.defaults }));
    const [loading, setLoading] = useState(!!group && !!form.load);
    const [loadFailure, setLoadFailure] = useState<string>();
    const [attempt, setAttempt] = useState(0);
    const { sending, failure, errors, send } = useFormSend(
        group ? text.mediaSaveGroupFailed : text.mediaCreateGroupFailed,
    );
    const sendingRef = useRef(false);
    const onLeftRef = useRef(onLeft);
    const loadRef = useRef(form.load);
    const params = {
        group,
        parent,
        asset: group ?? undefined,
        section,
        adapter,
        values,
        setValues,
        errors,
        index: 0,
        sending,
    };
    const ready = loading || loadFailure ? false : (form.ready?.(params) ?? true);
    const name = group ? isolate(group.name) : "";

    useEffect(() => {
        sendingRef.current = sending;
        onLeftRef.current = onLeft;
        loadRef.current = form.load;
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

    // What the group holds now, what's edited starting from it. Its own step's, by the group's id.
    useEffect(() => {
        const load = loadRef.current;

        if (!group || !load) {
            return;
        }

        const controller = new AbortController();
        const { signal } = controller;

        setLoading(true);
        setLoadFailure(undefined);
        Promise.resolve()
            .then(() => load({ group, section, adapter }, { signal }))
            .then(
                (loaded) => {
                    if (!signal.aborted) {
                        setValues({ ...loaded });
                        setLoading(false);
                    }
                },
                (error: unknown) => {
                    if (!signal.aborted) {
                        setLoadFailure(refusalOf(error, text.mediaLoadGroupFailed).message);
                        setLoading(false);
                    }
                },
            );

        return () => controller.abort();
        // Once for each try: a listing coming back mustn't undo what's been changed since.
    }, [attempt]);

    const submit = () => {
        let made: FileEntry | void;

        send(
            async (signal) => {
                made = group
                    ? await adapter.updateGroup?.(group, values, { signal })
                    : await adapter.createGroup?.(parentId, values, { signal });
            },
            () => {
                sendingRef.current = false;
                onDone(made ?? undefined);
            },
        );
    };

    return (
        <MediaStep
            title={form.title ?? (group ? text.mediaEditGroupTitle(name) : text.mediaNewGroup)}
            backLabel={backLabel}
            onBack={onCancel}
            note={typeof ready === "string" ? ready : undefined}
            noteId={noteId}
            footer={
                <>
                    <Button color="inherit" onClick={onCancel}>
                        {text.cancel}
                    </Button>
                    <StepSend
                        held={sending || ready !== true}
                        describedBy={typeof ready === "string" && ready ? noteId : undefined}
                        onClick={submit}
                    >
                        {form.submitLabel ?? (group ? text.mediaSaveGroup : text.create)}
                    </StepSend>
                </>
            }
        >
            {loadFailure ? (
                <Box role="alert" sx={stateSx}>
                    <bdi>{loadFailure}</bdi>
                    <Button size="small" onClick={() => setAttempt((count) => count + 1)}>
                        {text.tryAgain}
                    </Button>
                </Box>
            ) : loading ? (
                <Box sx={stateSx}>
                    <CircularProgress size={28} aria-label={text.loading} />
                </Box>
            ) : (
                <>
                    {failure && <FormFailure message={failure} />}
                    <MediaFormBody form={form} params={params} />
                </>
            )}
        </MediaStep>
    );
};

export default MediaGroup;
