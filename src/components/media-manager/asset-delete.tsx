import { useEffect, useId, useRef } from "react";

import { useFormSend } from "../../hooks/use-form-send";
import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import Button from "../ui/button";
import Text from "../ui/text";
import styles from "./asset-delete.module.css";
import { FormFailure } from "./media-form";

import type { FileAdapter, FileEntry } from "../../types";

interface AssetDeleteProps {
    entry: FileEntry;
    adapter: FileAdapter;
    /** Closes it, asking nothing of the backend, or stopping what was asked. */
    onCancel: () => void;
    onDeleted: () => void;
    /** Left while the backend was being asked, which may have deleted it by then. */
    onLeft: () => void;
}

/**
 * Asks before deleting the asset or group shown, in the view rather than in a dialog of its own, as a picker is
 * often in the app's own dialog already. Cancel takes the focus as it opens, as deleting can't be
 * undone, and Escape cancels. It stays until the adapter's `delete` answers, to say why when it's refused.
 */
const AssetDelete = ({ entry, adapter, onCancel, onDeleted, onLeft }: AssetDeleteProps) => {
    const { text } = useLocale();
    const titleId = useId();
    const warningId = useId();
    const cancelRef = useRef<HTMLButtonElement>(null);
    const { sending, failure, send } = useFormSend(text.deleteFailed(1));
    const sendingRef = useRef(false);
    const onLeftRef = useRef(onLeft);

    useEffect(() => cancelRef.current?.focus(), []);

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

    return (
        <div
            role="group"
            aria-labelledby={titleId}
            aria-describedby={warningId}
            aria-busy={sending}
            className={styles.root}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel();
                }
            }}
        >
            <div className={styles.text}>
                <Text id={titleId} className={styles.title}>
                    {text.deleteTitle(1, isolate(entry.name))}
                </Text>
                <Text id={warningId} className={styles.warning}>
                    {text.deleteWarning(1, entry.kind === "folder")}
                </Text>
                {failure && <FormFailure message={failure} />}
            </div>
            <div className={styles.buttons}>
                <Button ref={cancelRef} color="inherit" onClick={onCancel}>
                    {text.cancel}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    disableElevation
                    aria-disabled={sending}
                    onClick={
                        sending
                            ? undefined
                            : () =>
                                  send(
                                      (signal) => adapter.delete?.([entry], { signal }),
                                      () => {
                                          sendingRef.current = false;
                                          onDeleted();
                                      },
                                  )
                    }
                >
                    {text.delete}
                </Button>
            </div>
        </div>
    );
};

export default AssetDelete;
