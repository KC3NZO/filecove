import { folderOf } from "./navigation";

import type {
    ConflictPolicy,
    EntryGroup,
    FileAdapter,
    FileEntry,
    MadePair,
    Section,
    UndoAction,
    UndoDirection,
    UndoHistory,
    UndoStep,
} from "../types";

/** How many changes are kept to undo, unless `FileManagerLimits.undoSteps` says otherwise. */
export const UNDO_STEPS = 20;

export const NO_HISTORY: UndoHistory = { undo: [], redo: [] };

/** The other list of the history: what undoing a step leaves to redo, and the other way round. */
export const otherWay = (direction: UndoDirection): UndoDirection => (direction === "undo" ? "redo" : "undo");

/** The latest `limit` steps of a list, `Infinity` keeping them all. */
export const latestSteps = (steps: UndoStep[], limit: number) =>
    steps.length <= limit ? steps : limit <= 0 ? [] : steps.slice(steps.length - limit);

/**
 * What each entry a copy or move took became, from what the adapter says it made
 * (`TransferResult`), or null when that can't be told, so it can't be undone: nothing was said,
 * "replace" took the place of what was there, which is gone, or what came back doesn't answer what
 * was given. Kept both, every entry went, in their order; skipped, those that went kept their names.
 */
export const madePairs = (
    given: readonly FileEntry[],
    made: readonly FileEntry[] | undefined,
    conflict: ConflictPolicy,
): MadePair[] | null => {
    if (!made || conflict === "replace") {
        return null;
    }

    if (conflict === "keepBoth") {
        return made.length === given.length && made.every((entry, index) => entry.kind === given[index].kind)
            ? given.map((from, index) => ({ from, to: made[index] }))
            : null;
    }

    const byName = new Map(given.map((entry) => [`${entry.kind}/${entry.name}`, entry] as const));
    const pairs = made.flatMap((to) => {
        const from = byName.get(`${to.kind}/${to.name}`);

        return from ? [{ from, to }] : [];
    });

    return pairs.length === made.length ? pairs : null;
};

// Whether two values an entry may leave out are the same, or either isn't known.
const sameOrUnknown = <T>(a: T | undefined, b: T | undefined, same: (a: T, b: T) => boolean = Object.is) =>
    a === undefined || b === undefined || same(a, b);

/**
 * Entries as a folder's listing now has them, each by its id, with the kind and name it had, and,
 * `exactly`, the size, date modified and, for a folder, the count of what's in it it had, where both
 * say: `found` in their order, and those that aren't (`changed`), renamed, replaced, changed, moved
 * or gone since.
 */
export const asLeft = (listed: readonly FileEntry[], expected: readonly FileEntry[], exactly: boolean) => {
    const byId = new Map(listed.map((entry) => [entry.id, entry] as const));
    const found: FileEntry[] = [];
    const changed: FileEntry[] = [];

    expected.forEach((entry) => {
        const now = byId.get(entry.id);
        const same =
            !!now &&
            now.kind === entry.kind &&
            now.name === entry.name &&
            (!exactly ||
                (sameOrUnknown(now.size, entry.size) &&
                    sameOrUnknown(now.childCount, entry.childCount) &&
                    sameOrUnknown(now.modifiedAt, entry.modifiedAt, (a, b) => a.getTime() === b.getTime())));

        if (now && same) {
            found.push(now);
        } else {
            changed.push(entry);
        }
    });

    return { found, changed };
};

/** The groups of entries an action acts on, where they are now. */
export const actionGroups = (action: UndoAction): EntryGroup[] => {
    switch (action.kind) {
        case "rename":
        case "remove":
            return [action.group];
        case "removeCopies":
            return [action.group, ...action.sources];
        case "copy":
            return action.sources;
        case "move":
            return action.moves.map((move) => move.group);
        case "trash":
            return action.groups;
        // Entries in the trash, which no folder of a section holds.
        case "create":
        case "restore":
            return [];
    }
};

/**
 * The folders an action changes, which show the progress bar while it runs. The trash an action
 * moves entries to, or restores them from, isn't named by it, and is the file manager's to add.
 */
export const changedFolders = (action: UndoAction) => {
    switch (action.kind) {
        case "create":
        case "copy":
            return [folderOf(action.to.section, action.to.trail).id];
        case "move":
            return action.moves.flatMap((move) => [
                folderOf(move.group.section, move.group.trail).id,
                folderOf(move.to.section, move.to.trail).id,
            ]);
        case "trash":
            return action.groups.map((group) => folderOf(group.section, group.trail).id);
        case "restore":
            return action.restores.map((restore) => folderOf(restore.to.section, restore.to.trail).id);
        default:
            return [folderOf(action.group.section, action.group.trail).id];
    }
};

/** Every section an action names: where its entries are, and where it puts what it makes or moves. */
export const actionSections = (action: UndoAction): Section[] => [
    ...actionGroups(action).map((group) => group.section),
    ...(action.kind === "create" || action.kind === "copy" ? [action.to.section] : []),
    ...(action.kind === "move" ? action.moves.map((move) => move.to.section) : []),
    ...(action.kind === "restore" ? action.restores.map((restore) => restore.to.section) : []),
];

/**
 * Whether a step still means what it did: every section it names is the file manager's, rooted where
 * it was and served by the step's adapter, as another adapter's ids, or another root's trails, name
 * something else.
 */
export const stepHolds = (step: UndoStep, sectionsById: ReadonlyMap<string, Section>, adapter: FileAdapter) =>
    actionSections(step.action).every((section) => {
        const now = sectionsById.get(section.id);

        return !!now && now.rootId === section.rootId && (now.adapter ?? adapter) === step.adapter;
    });

/** The history without the steps that no longer mean what they did (`stepHolds`), the same object when none goes. */
export const heldHistory = (
    history: UndoHistory,
    sectionsById: ReadonlyMap<string, Section>,
    adapter: FileAdapter,
): UndoHistory => {
    const holds = (step: UndoStep) => stepHolds(step, sectionsById, adapter);

    return history.undo.every(holds) && history.redo.every(holds)
        ? history
        : { undo: history.undo.filter(holds), redo: history.redo.filter(holds) };
};

/** Whether an adapter can undo a change of some kind, for the main menu and the keys to be offered at all. */
export const canUndoWith = (adapter: FileAdapter) =>
    !!adapter.rename ||
    !!adapter.move ||
    (!!adapter.trash && !!adapter.restore) ||
    (!!adapter.delete && (!!adapter.createFolder || !!adapter.copy));
