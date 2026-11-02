import { useEffect, useRef, useState } from "react";

import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import { MediaFormBody } from "./media-form";
import MediaStep from "./media-step";

import type { FileAdapter, FileEntry, MediaForm, MediaProcessFormParams, MediaSection } from "../../types";

interface MediaProcessProps {
    entry: FileEntry;
    section: MediaSection;
    /** The library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /** What can be asked of it: its library's process form, as it was when this opened. */
    form: MediaForm<MediaProcessFormParams>;
    onCancel: () => void;
    /** The backend took it on, or may have by the time it was cancelled: its library is listed again. */
    onSent: () => void;
}

// Not `disabled` while it's being sent, which would lose the focus, so Escape would do nothing after
// it's refused.
const sendSx: SxProps<Theme> = { '&[aria-disabled="true"]': { opacity: 0.6, cursor: "default" } };

/**
 * The step asking what's to be made of an asset already uploaded, in the library's place: the
 * library's process form, with Cancel and Process. What it holds goes to the adapter's `process`, and
 * it stays open until that's answered, to say why when it's refused.
 */
const MediaProcess = ({ entry, section, adapter, form, onCancel, onSent }: MediaProcessProps) => {
    const { text } = useLocale();
    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...form.defaults }));
    const [sending, setSending] = useState(false);
    const [failure, setFailure] = useState<string>();
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const send = () => {
        if (sending) {
            return;
        }

        const controller = new AbortController();

        controllerRef.current = controller;
        setSending(true);
        setFailure(undefined);
        Promise.resolve()
            .then(() => adapter.process?.(entry, values, { signal: controller.signal }))
            .then(
                () => {
                    if (!controller.signal.aborted) {
                        onSent();
                    }
                },
                (error: unknown) => {
                    if (!controller.signal.aborted) {
                        setSending(false);
                        setFailure((error instanceof Error && error.message) || text.mediaProcessFailed);
                    }
                },
            );
    };

    // Leaving while it's being sent stops it, but the backend may have taken it on by then.
    const leave = () => {
        if (sending) {
            controllerRef.current?.abort();
            onSent();
        } else {
            onCancel();
        }
    };

    return (
        <MediaStep
            title={text.mediaProcessTitle(isolate(entry.name))}
            backLabel={text.mediaBackToAsset(isolate(entry.name))}
            onBack={leave}
            footer={
                <>
                    <Button color="inherit" onClick={leave}>
                        {text.cancel}
                    </Button>
                    <Button variant="contained" disableElevation aria-disabled={sending} sx={sendSx} onClick={send}>
                        {text.mediaProcess}
                    </Button>
                </>
            }
        >
            {failure && (
                <Typography role="alert" variant="body2" color="error.main">
                    <bdi>{failure}</bdi>
                </Typography>
            )}
            <MediaFormBody form={form} params={{ asset: entry, section, adapter, values, setValues }} />
        </MediaStep>
    );
};

export default MediaProcess;
