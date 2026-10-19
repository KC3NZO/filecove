import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import type { ConflictPolicy } from "../../../types";

interface ConflictMessageProps {
    /** Names the folder already has. */
    names: string[];
    folderName: string;
}

interface ConflictChoicesProps {
    /** The choice being carried out, which shows a spinner; every choice is disabled meanwhile. */
    pending: ConflictPolicy | null;
    onChoose: (conflict: ConflictPolicy) => void;
}

/** Says which names a copy or move clashes with, for the dialogs that ask what to do. */
export const ConflictMessage = ({ names, folderName }: ConflictMessageProps) => (
    <>
        <Typography color="text.primary" fontWeight={600}>
            {names.length === 1
                ? `“${names[0]}” already exists in “${folderName}”.`
                : `${names.length} items already exist in “${folderName}”.`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
            Replace what is there, keep both with new names, or skip {names.length === 1 ? "it" : "them"}.
        </Typography>
    </>
);

/** Skip, Keep both and Replace, in that order, with Replace as the main action. */
export const ConflictChoices = ({ pending, onChoose }: ConflictChoicesProps) => (
    <>
        <Button color="inherit" disabled={!!pending} loading={pending === "skip"} onClick={() => onChoose("skip")}>
            Skip
        </Button>
        <Button
            color="inherit"
            disabled={!!pending}
            loading={pending === "keepBoth"}
            onClick={() => onChoose("keepBoth")}
        >
            Keep both
        </Button>
        <Button
            variant="contained"
            disabled={!!pending}
            loading={pending === "replace"}
            onClick={() => onChoose("replace")}
        >
            Replace
        </Button>
    </>
);
