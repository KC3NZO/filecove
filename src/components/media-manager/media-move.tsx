import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useFolder } from "../../hooks/use-folder";
import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import { isHidden } from "../../utils/hidden";
import { groupRule } from "../../utils/media";
import { allows } from "../../utils/permissions";
import Icon from "../icons/icon";
import Button from "../ui/button";
import ButtonBase from "../ui/button-base";
import CircularProgress from "../ui/circular-progress";
import Text from "../ui/text";
import GroupPath from "./group-path";
import styles from "./media-move.module.css";
import MediaStep, { StepSend } from "./media-step";

import type { FileEntry, MediaSection } from "../../types";

interface MediaMoveProps {
    /** The asset or group being moved. */
    entry: FileEntry;
    section: MediaSection;
    /** The groups it's in now, from the library's root, where the way through starts. */
    from: readonly FileEntry[];
    /** Those on their way somewhere already, which can't be gone into. */
    movingIds: ReadonlySet<string>;
    onCancel: () => void;
    /** Moves it into the level with these groups open. */
    onMove: (to: readonly FileEntry[]) => void;
}

/**
 * Where an asset or group goes, a step in the library's place: a level at a time through its library's
 * groups, as they're only ever listed so, from where it is now, a group never being offered to itself,
 * so nothing goes inside itself. It stays in its library, as what a library holds is one kind. Move
 * here is held back where it already is, where the listing or the group says nothing can be written,
 * and for a group, where the library's `createGroups` says none can be. The backend has the final say.
 */
const MediaMove = ({ entry, section, from, movingIds, onCancel, onMove }: MediaMoveProps) => {
    const { text, compareNames } = useLocale();
    const noteId = useId();
    const [trail, setTrail] = useState(from);
    const parent = trail.at(-1);
    const here = parent?.id ?? section.rootId;
    const { state, reload } = useFolder(section, here, true, true);
    const levelRef = useRef<HTMLDivElement>(null);
    const shownRef = useRef(here);
    const levelName = parent?.name ?? section.label;

    const groups = useMemo(
        () =>
            (state?.entries ?? [])
                .filter(
                    (each) =>
                        each.kind === "folder" && !isHidden(each) && each.id !== entry.id && !movingIds.has(each.id),
                )
                .sort((a, b) => compareNames(a.name, b.name)),
        [state?.entries, entry.id, movingIds, compareNames],
    );

    // The rows it was gone in by have gone, so the level takes the focus, read out by where it is.
    useEffect(() => {
        if (shownRef.current !== here) {
            shownRef.current = here;
            levelRef.current?.focus();
        }
    }, [here]);

    const refusal =
        here === (from.at(-1)?.id ?? section.rootId)
            ? text.mediaMoveAlreadyHere
            : entry.kind === "folder" && !(groupRule(section, parent ?? null) ?? true)
              ? text.mediaMoveNoGroupsHere
              : state && !allows("write", state.permissions, parent?.permissions)
                ? text.mediaMoveRefusedHere
                : undefined;
    const name = isolate(entry.name);

    return (
        <MediaStep
            title={text.moveTitle(1, name)}
            backLabel={text.mediaBackToAsset(name)}
            onBack={onCancel}
            note={refusal}
            noteId={noteId}
            footer={
                <>
                    <Button color="inherit" onClick={onCancel}>
                        {text.cancel}
                    </Button>
                    <StepSend
                        held={!!refusal || state?.status !== "ready"}
                        describedBy={refusal ? noteId : undefined}
                        onClick={() => onMove(trail)}
                    >
                        {text.mediaMoveHere}
                    </StepSend>
                </>
            }
        >
            <div className={styles.pathRow}>
                <GroupPath
                    label={section.label}
                    trail={trail}
                    heading={false}
                    onGoToLevel={(depth) => setTrail(trail.slice(0, depth))}
                />
            </div>
            <div
                ref={levelRef}
                role="group"
                tabIndex={-1}
                aria-label={text.mediaInGroup(isolate(levelName))}
                aria-busy={state?.status === "loading"}
                className={styles.level}
            >
                {state?.status === "error" ? (
                    <div role="alert" className={styles.state}>
                        <bdi>
                            {state.error instanceof Error && state.error.message
                                ? state.error.message
                                : parent
                                  ? text.mediaGroupLoadFailed
                                  : text.mediaLoadFailed}
                        </bdi>
                        <Button size="small" onClick={() => reload()}>
                            {text.tryAgain}
                        </Button>
                    </div>
                ) : groups.length > 0 ? (
                    <ul className={styles.list}>
                        {groups.map((group) => (
                            <li key={group.id}>
                                <ButtonBase className={styles.row} onClick={() => setTrail([...trail, group])}>
                                    <Icon name="folder" fontSize="small" className={styles.rowIcon} />
                                    <Text noWrap className={styles.rowName}>
                                        <bdi>{group.name}</bdi>
                                    </Text>
                                    <Icon name="chevronRight" fontSize="small" className={styles.rowIcon} />
                                </ButtonBase>
                            </li>
                        ))}
                    </ul>
                ) : state?.status === "ready" ? (
                    <Text className={styles.state}>{text.mediaMoveNoGroups}</Text>
                ) : (
                    <div className={styles.state}>
                        <CircularProgress size={28} aria-label={text.loading} />
                    </div>
                )}
            </div>
        </MediaStep>
    );
};

export default MediaMove;
