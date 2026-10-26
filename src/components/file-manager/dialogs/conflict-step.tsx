import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { isolate } from "../../../utils/bidi";

import type { Clash, ConflictPolicy } from "../../../types";

interface ConflictMessageProps {
    clashes: Clash[];
    /**
     * The folder the names clash in, or null when they're in several, as a restore's may be, the
     * entries going back to the folders they came from.
     */
    folderName: string | null;
}

interface ConflictChoicesProps {
    clashes: Clash[];
    /** The choice being carried out, which shows a spinner; every choice is disabled meanwhile. */
    pending: ConflictPolicy | null;
    onChoose: (conflict: ConflictPolicy) => void;
}

const messageSx: SxProps<Theme> = {
    color: "text.primary",
    fontWeight: 600,
};

/**
 * What Replace would do to the clashes: replace a file with a file, merge a folder into a folder,
 * and keep both a file and a folder, which can't take each other's place, and what comes in beside
 * an entry its permissions keep from being replaced or merged into (`locked`).
 */
const sortClashes = (clashes: Clash[]) => {
    const alike = clashes.filter((clash) => clash.kind === clash.there);

    return {
        replacing: alike.filter((clash) => clash.kind === "file" && !clash.locked).length,
        merging: alike.filter((clash) => clash.kind === "folder" && !clash.locked).length,
        otherKind: clashes.filter((clash) => clash.kind !== clash.there),
        locked: alike.filter((clash) => clash.locked),
    };
};

/**
 * Says which names a copy, move, upload or restore clashes with, the folder's or each other's, as
 * entries from several folders may share names, and what each choice does to them.
 */
export const ConflictMessage = ({ clashes, folderName }: ConflictMessageProps) => {
    const { text } = useLocale();
    const { replacing, merging, otherKind, locked } = sortClashes(clashes);
    const replaces = replacing + merging > 0;
    const there = clashes.filter((clash) => !clash.shared);
    const shared = clashes.filter((clash) => clash.shared);

    let message: string;
    let hint: string;

    if (folderName === null) {
        message =
            there.length > 0
                ? text.restoreConflictMessage(there.length, isolate(there[0].name))
                : text.restoreSharedMessage(shared.length, isolate(shared[0].name));
    } else {
        message =
            there.length > 0
                ? text.conflictMessage(there.length, isolate(there[0].name), isolate(folderName))
                : text.conflictSharedMessage(shared.length, isolate(shared[0].name), isolate(folderName));
    }

    if (!replaces && locked.length === 0) {
        hint = text.conflictKindHint(otherKind.length, otherKind[0].there);
    } else if (!replaces && otherKind.length === 0) {
        hint = text.conflictLockedHint(locked.length, locked[0].there);
    } else if (!replaces) {
        hint = text.conflictNothingReplacedHint;
    } else if (replacing === 0) {
        hint = text.conflictMergeHint(clashes.length);
    } else {
        hint = text.conflictHint(clashes.length);
    }

    return (
        <>
            <Typography sx={messageSx}>{message}</Typography>
            {there.length > 0 && shared.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                    {text.conflictSharedToo(shared.length, isolate(shared[0].name))}
                </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
                {hint}
            </Typography>
            {replacing > 0 && merging > 0 && (
                <Typography variant="body2" color="text.secondary">
                    {text.conflictReplaceMerges(merging)}
                </Typography>
            )}
            {replaces && otherKind.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                    {text.conflictKindKept(otherKind.length, isolate(otherKind[0].name))}
                </Typography>
            )}
            {replaces && locked.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                    {text.conflictLockedKept(locked.length, isolate(locked[0].name))}
                </Typography>
            )}
        </>
    );
};

/**
 * Skip, Replace and Keep both, in that order, with Keep both, which loses nothing, as the main
 * action. Replace reads Merge when it would only merge folders, and is left out when it would do
 * nothing but keep both, as every name clashes with one of the other kind or one that can't be
 * changed.
 */
export const ConflictChoices = ({ clashes, pending, onChoose }: ConflictChoicesProps) => {
    const { text } = useLocale();
    const { replacing, merging } = sortClashes(clashes);

    return (
        <>
            <Button color="inherit" disabled={!!pending} loading={pending === "skip"} onClick={() => onChoose("skip")}>
                {text.skip}
            </Button>
            {replacing + merging > 0 && (
                <Button
                    color="inherit"
                    disabled={!!pending}
                    loading={pending === "replace"}
                    onClick={() => onChoose("replace")}
                >
                    {replacing > 0 ? text.replace : text.merge}
                </Button>
            )}
            <Button
                variant="contained"
                disabled={!!pending}
                loading={pending === "keepBoth"}
                onClick={() => onChoose("keepBoth")}
            >
                {text.keepBoth}
            </Button>
        </>
    );
};
