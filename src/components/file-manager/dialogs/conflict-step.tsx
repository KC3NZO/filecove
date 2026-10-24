import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import { useLocale } from "../../../hooks/use-locale";
import { isolate } from "../../../utils/bidi";

import type { Clash, ConflictPolicy } from "../../../types";

interface ConflictMessageProps {
    clashes: Clash[];
    folderName: string;
}

interface ConflictChoicesProps {
    clashes: Clash[];
    /** The choice being carried out, which shows a spinner; every choice is disabled meanwhile. */
    pending: ConflictPolicy | null;
    onChoose: (conflict: ConflictPolicy) => void;
}

/**
 * What Replace would do to the clashes: replace a file with a file, merge a folder into a folder,
 * and keep both a file and a folder, which can't take each other's place.
 */
const sortClashes = (clashes: Clash[]) => ({
    replacing: clashes.filter((clash) => clash.kind === "file" && clash.there === "file").length,
    merging: clashes.filter((clash) => clash.kind === "folder" && clash.there === "folder").length,
    otherKind: clashes.filter((clash) => clash.kind !== clash.there),
});

/** Says which names a copy, move or upload clashes with, and what each choice does to them. */
export const ConflictMessage = ({ clashes, folderName }: ConflictMessageProps) => {
    const { text } = useLocale();
    const { replacing, merging, otherKind } = sortClashes(clashes);
    const replaces = replacing + merging > 0;

    let hint: string;

    if (!replaces) {
        hint = text.conflictKindHint(otherKind.length, otherKind[0].there);
    } else if (replacing === 0) {
        hint = text.conflictMergeHint(clashes.length);
    } else {
        hint = text.conflictHint(clashes.length);
    }

    return (
        <>
            <Typography color="text.primary" fontWeight={600}>
                {text.conflictMessage(clashes.length, isolate(clashes[0].name), isolate(folderName))}
            </Typography>
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
        </>
    );
};

/**
 * Skip, Replace and Keep both, in that order, with Keep both, which loses nothing, as the main
 * action. Replace reads Merge when it would only merge folders, and is left out when it would do
 * nothing but keep both, as every name clashes with one of the other kind.
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
