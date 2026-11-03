import { useEffect, useId, useRef } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFormSend } from "../../hooks/use-form-send";
import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
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

// Under the view's header, across it, as what's said of the asset's processing is.
const rootSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 1,
    flexShrink: 0,
    px: 2,
    py: 1,
    borderBottom: 1,
    borderColor: "divider",
};

const textSx: SxProps<Theme> = { flex: "1 1 14rem", minWidth: 0, overflowWrap: "anywhere" };

const titleSx: SxProps<Theme> = { fontSize: "0.8125rem", fontWeight: 700 };

const warningSx: SxProps<Theme> = { color: "text.secondary", fontSize: "0.8125rem" };

const buttonsSx: SxProps<Theme> = { display: "flex", gap: 1, flexShrink: 0, marginInlineStart: "auto" };

/**
 * Asks before deleting the asset shown, in the view rather than in a dialog of its own, as a picker is
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
        <Box
            role="group"
            aria-labelledby={titleId}
            aria-describedby={warningId}
            aria-busy={sending}
            sx={rootSx}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel();
                }
            }}
        >
            <Box sx={textSx}>
                <Typography id={titleId} sx={titleSx}>
                    {text.deleteTitle(1, isolate(entry.name))}
                </Typography>
                <Typography id={warningId} sx={warningSx}>
                    {text.deleteWarning(1, false)}
                </Typography>
                {failure && <FormFailure message={failure} />}
            </Box>
            <Box sx={buttonsSx}>
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
            </Box>
        </Box>
    );
};

export default AssetDelete;
