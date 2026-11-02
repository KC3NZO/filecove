import { useId, useState } from "react";

import Button from "@mui/material/Button";

import { useFormSend } from "../../hooks/use-form-send";
import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import { FormFailure, MediaFormBody } from "./media-form";
import MediaStep, { StepSend } from "./media-step";

import type { FileAdapter, FileEntry, MediaProcessForm, MediaSection } from "../../types";

interface MediaProcessProps {
    /** The asset as it's listed now, which the form follows. */
    entry: FileEntry;
    section: MediaSection;
    /** The library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /** What can be asked of it: its library's process form for it now, or else as it was when this opened. */
    form: MediaProcessForm;
    /** Whether its library has nothing to ask of it now, which holds Process back. */
    unavailable: boolean;
    onCancel: () => void;
    /** The backend took it on, or may have by the time it was cancelled: its library is listed again. */
    onSent: () => void;
}

/**
 * The step asking what's to be made of an asset already uploaded, in the library's place: the
 * library's process form, with Cancel and Process, held back while it isn't ready. What it holds goes to
 * the adapter's `process`, and it stays open until that's answered, to say why when it's refused,
 * over the form and under the fields it names.
 */
const MediaProcess = ({ entry, section, adapter, form, unavailable, onCancel, onSent }: MediaProcessProps) => {
    const { text } = useLocale();
    const noteId = useId();
    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...form.defaults }));
    const { sending, failure, errors, send, abort } = useFormSend(text.mediaProcessFailed);
    const params = { asset: entry, section, adapter, values, setValues, errors, index: 0, sending };
    const ready = unavailable ? text.mediaProcessUnavailable : (form.ready?.(params) ?? true);

    // Leaving while it's being sent stops it, but the backend may have taken it on by then.
    const leave = () => {
        if (sending) {
            abort();
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
            note={typeof ready === "string" ? ready : undefined}
            noteId={noteId}
            footer={
                <>
                    <Button color="inherit" onClick={leave}>
                        {text.cancel}
                    </Button>
                    <StepSend
                        held={sending || ready !== true}
                        describedBy={typeof ready === "string" && ready ? noteId : undefined}
                        onClick={() => send((signal) => adapter.process?.(entry, values, { signal }), onSent)}
                    >
                        {text.mediaProcess}
                    </StepSend>
                </>
            }
        >
            {failure && <FormFailure message={failure} />}
            <MediaFormBody form={form} params={params} />
        </MediaStep>
    );
};

export default MediaProcess;
