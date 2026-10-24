import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { useLocale } from "../../../hooks/use-locale";
import { isolate } from "../../../utils/bidi";

import type { ConflictPolicy } from "../../../types";

interface ConflictMessageProps {
    /** Names the folder already has. */
    names: string[];
    folderName: string;
    /** In place of the usual hint, for choices that mean something else here. */
    hint?: string;
}

interface ConflictChoicesProps {
    /** The choice being carried out, which shows a spinner; every choice is disabled meanwhile. */
    pending: ConflictPolicy | null;
    onChoose: (conflict: ConflictPolicy) => void;
    /** In place of Replace, for a choice that means something else here, such as Merge. */
    replaceLabel?: string;
}

/** Says which names a copy or move clashes with, for the dialogs that ask what to do. */
export const ConflictMessage = ({ names, folderName, hint }: ConflictMessageProps) => {
    const { text } = useLocale();

    return (
        <>
            <Typography color="text.primary" fontWeight={600}>
                {text.conflictMessage(names.length, isolate(names[0]), isolate(folderName))}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {hint ?? text.conflictHint(names.length)}
            </Typography>
        </>
    );
};

/** Skip, Keep both and Replace, in that order, with Replace as the main action. */
export const ConflictChoices = ({ pending, onChoose, replaceLabel }: ConflictChoicesProps) => {
    const { text } = useLocale();

    return (
        <>
            <Button color="inherit" disabled={!!pending} loading={pending === "skip"} onClick={() => onChoose("skip")}>
                {text.skip}
            </Button>
            <Button
                color="inherit"
                disabled={!!pending}
                loading={pending === "keepBoth"}
                onClick={() => onChoose("keepBoth")}
            >
                {text.keepBoth}
            </Button>
            <Button
                variant="contained"
                disabled={!!pending}
                loading={pending === "replace"}
                onClick={() => onChoose("replace")}
            >
                {replaceLabel ?? text.replace}
            </Button>
        </>
    );
};
