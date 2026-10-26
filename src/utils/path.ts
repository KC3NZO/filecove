import { listingOf } from "../store/folder-store";
import { isolate } from "./bidi";
import { folderOf } from "./navigation";

import type { FolderStore } from "../store/folder-store";
import type {
    FileAdapter,
    FileEntry,
    FileManagerLocaleText,
    FileManagerLocation,
    FolderRef,
    PathProblem,
    PathResult,
    Section,
} from "../types";

/** What `resolvePath` reads from the file manager. */
export interface PathContext {
    /** Where a path not starting with "/" begins: the open place, in `section`. */
    place: FileManagerLocation;
    section: Section;
    /** Every section, in the sidebar's order, whose labels a path starting with "/" begins with. */
    sections: readonly Section[];
    /** The file manager's adapter, for the sections that bring none of their own. */
    adapter: FileAdapter;
    store: FolderStore;
    /** `Locale.foldLetters`, which names are matched by when none is the same as typed. */
    fold: (text: string) => string;
}

// The names of a typed path, without its slashes or the spaces around the names.
const segmentsOf = (typed: string) =>
    typed
        .split("/")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

/**
 * A place written as the path bar writes it, led by a slash: the section's label, then the folders
 * below its root, which is what a path starting with "/" is resolved from.
 */
export const pathOf = (section: Section, trail: readonly FolderRef[]) =>
    `/${[section.label, ...trail.map((folder) => folder.name)].join("/")}`;

// The section a path starting with "/" begins with, and how many of its names the label takes. A
// label is read as the names it holds, so one with a slash in it works, and the longest label wins.
// One the same as typed comes before one that's the same by letters alone.
const sectionNamed = (segments: readonly string[], sections: readonly Section[], fold: (text: string) => string) => {
    const match = (same: (a: string, b: string) => boolean) => {
        let best: { section: Section; length: number } | undefined;

        for (const section of sections) {
            const names = segmentsOf(section.label);

            if (
                names.length > 0 &&
                names.length <= segments.length &&
                names.every((name, index) => same(name, segments[index])) &&
                (!best || names.length > best.length)
            ) {
                best = { section, length: names.length };
            }
        }

        return best;
    };

    return match((a, b) => a === b) ?? match((a, b) => fold(a) === fold(b));
};

// The entry a typed name stands for: the one called exactly that, a folder before a file of the
// same name, or else the only one called that by letters alone, case and accents aside. Several
// that differ only so are left unsaid, rather than one guessed.
const entryNamed = (entries: readonly FileEntry[], name: string, fold: (text: string) => string) => {
    const exact = entries.filter((entry) => entry.name === name);

    if (exact.length > 0) {
        return exact.find((entry) => entry.kind === "folder") ?? exact[0];
    }

    const letters = fold(name);
    const similar = entries.filter((entry) => fold(entry.name) === letters);

    return similar.length === 1 ? similar[0] : undefined;
};

/**
 * Where a typed path leads. It starts with "/" and a section's label, as the path bar writes a
 * place, or else it begins in the open folder. Then come the names of folders, a name at a time
 * looked for in the folder's listing (the cached one, listed afresh when it has no such name, since
 * it may be from before a change), so the adapter is asked for nothing new and no id is parsed. "."
 * stays and ".." goes up a folder, stopping at the section's root. The last name may be a file, which
 * leads to its folder, with the file named. Hidden entries are found as the rest are.
 *
 * Rejects with `signal`'s reason when it aborts.
 */
export const resolvePath = async (
    typed: string,
    { place, section: open, sections, adapter, store, fold }: PathContext,
    signal: AbortSignal,
): Promise<PathResult> => {
    let section = open;
    let trail: FolderRef[] = [...place.trail];
    let names = segmentsOf(typed);

    if (typed.trimStart().startsWith("/") && names.length > 0) {
        const named = sectionNamed(names, sections, fold);

        if (!named) {
            return { found: false, problem: { kind: "section", name: names[0] } };
        }

        section = named.section;
        trail = [];
        names = names.slice(named.length);
    }

    const target = section;
    const served = target.adapter ?? adapter;
    const list = (folder: FolderRef, fresh: boolean) =>
        listingOf(store, target.id, served, folder.id, fresh, signal);

    for (const [index, name] of names.entries()) {
        if (name === ".") {
            continue;
        }

        if (name === "..") {
            trail.pop();

            continue;
        }

        const folder = folderOf(target, trail);
        let hit: FileEntry | undefined;

        try {
            hit = entryNamed(await list(folder, false), name, fold);
            hit ??= entryNamed(await list(folder, true), name, fold);
        } catch (error) {
            if (signal.aborted) {
                throw error;
            }

            return { found: false, problem: { kind: "failed", folder: folder.name, error } };
        }

        if (!hit) {
            return { found: false, problem: { kind: "missing", name, folder: folder.name } };
        }

        if (hit.kind === "file") {
            return index === names.length - 1
                ? { found: true, location: { sectionId: target.id, trail }, entryId: hit.id }
                : { found: false, problem: { kind: "notFolder", name: hit.name } };
        }

        trail.push({ id: hit.id, name: hit.name });
    }

    return { found: true, location: { sectionId: target.id, trail } };
};

/** Why a path leads nowhere, in the file manager's text, with the names isolated. */
export const pathProblemText = (problem: PathProblem, text: FileManagerLocaleText) => {
    switch (problem.kind) {
        case "section":
            return text.pathNoSection(isolate(problem.name));
        case "missing":
            return text.pathNotFound(isolate(problem.name), isolate(problem.folder));
        case "notFolder":
            return text.pathNotFolder(isolate(problem.name));
        case "failed":
            return text.pathListFailed(
                isolate(problem.folder),
                problem.error instanceof Error && problem.error.message ? isolate(problem.error.message) : undefined,
            );
    }
};
