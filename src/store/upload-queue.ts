import type {
    ConflictPolicy,
    FileAdapter,
    FileEntry,
    FolderContents,
    FolderRef,
    FolderUpload,
    UploadItem,
    UploadStatus,
} from "../types";

/** How many calls to the adapter run at once, files sent and folders made; the rest wait their turn. */
const MAX_ACTIVE = 3;

/** How often, at most, the folders uploads ended in are reported, in ms. */
const REPORT_INTERVAL = 1000;

const isActive = (item: UploadItem) => item.status === "queued" || item.status === "uploading";

// Where a step of an upload has got to: waiting its turn, or for the folder it goes into, under way,
// or ended.
type StepState = "waiting" | "running" | "done" | "failed";

/** A file to send: one uploaded on its own, or one in a folder uploaded. */
interface FileStep {
    kind: "file";
    file: File;
    /** The folder of a folder upload it goes into; none for a file uploaded on its own. */
    into?: FolderStep;
    state: StepState;
    /** How much has been sent, from 0 to 1, once the adapter has reported any. */
    progress?: number;
}

/**
 * A folder of a folder upload, made with `createFolder`, or, when it's merged into a folder already
 * there, listed instead, so the folders in it that are there too are merged as well.
 */
interface FolderStep {
    kind: "folder";
    name: string;
    /** The folder it's in; none for the folder uploaded, which goes into the upload's folder. */
    parent?: FolderStep;
    /** Its id, once made, or from the start for a folder merged into. */
    id?: string;
    merge: boolean;
    /** What a folder merged into already holds, by name, once listed. */
    holds?: Map<string, FileEntry>;
    files: FileStep[];
    folders: FolderStep[];
    state: StepState;
}

type Step = FileStep | FolderStep;

/** An upload as the queue runs it: what it shows as, and the steps it's made of. */
interface Job {
    item: UploadItem;
    /** The folder uploaded, as the check settled it; none for a file on its own. */
    upload?: FolderUpload;
    /** Files a folder upload leaves out for their type. */
    accepts?: (file: File) => boolean;
    /** A folder upload's folder, once read. */
    root?: FolderStep;
    reading: boolean;
    /** Every file to send, once known. */
    files: FileStep[];
    /** Steps that can start, in order, from `next` on. */
    ready: Step[];
    next: number;
    running: Map<Step, AbortController>;
    /** Whether a step has started since it was queued or tried again, so it counts as under way. */
    started: boolean;
    cancelled: boolean;
    /** Steps that failed, and of the files, those that did and those below folders that did. */
    failures: number;
    failedFiles: number;
    doneFiles: number;
    doneBytes: number;
    size: number;
    skipped: number;
    error?: string;
}

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

const countFiles = (folder: FolderStep): number =>
    folder.folders.reduce((count, child) => count + countFiles(child), folder.files.length);

/**
 * A folder read, as steps: its files that `accepts` takes, collected in `found`, and its folders,
 * but those left with nothing once files of other types are left out, unless they were empty to
 * start with. `skipped` counts the files left out.
 */
const toSteps = (
    contents: FolderContents,
    parent: FolderStep | undefined,
    accepts: ((file: File) => boolean) | undefined,
    found: FileStep[],
    skipped: { count: number },
): FolderStep | null => {
    const folder: FolderStep = {
        kind: "folder",
        name: contents.name,
        parent,
        merge: false,
        files: [],
        folders: [],
        state: "waiting",
    };
    const files = accepts ? contents.files.filter(accepts) : contents.files;

    skipped.count += contents.files.length - files.length;
    folder.files = files.map((file): FileStep => ({ kind: "file", file, into: folder, state: "waiting" }));
    folder.folders = contents.folders
        .map((child) => toSteps(child, folder, accepts, found, skipped))
        .filter((child): child is FolderStep => child !== null);

    const emptied =
        folder.files.length + folder.folders.length === 0 && contents.files.length + contents.folders.length > 0;

    if (emptied && parent) {
        return null;
    }

    folder.files.forEach((file) => found.push(file));

    return folder;
};

/** Everything a folder holds, every page of it, by name. */
const listAll = async (adapter: FileAdapter, folderId: string, signal: AbortSignal) => {
    const holds = new Map<string, FileEntry>();
    let cursor: string | undefined;

    do {
        const page = await adapter.list(folderId, { signal, cursor });

        if (page.nextCursor !== undefined && page.nextCursor === cursor) {
            throw new Error("The adapter's list handed back the cursor it was given.");
        }

        page.entries.forEach((entry) => holds.set(entry.name, entry));
        cursor = page.nextCursor;
    } while (cursor !== undefined);

    return holds;
};

const statusOf = (job: Job): UploadStatus => {
    if (job.cancelled) {
        return "cancelled";
    }

    if (job.reading || job.running.size > 0) {
        return "uploading";
    }

    if (job.next < job.ready.length) {
        return job.started ? "uploading" : "queued";
    }

    return job.failures > 0 ? "failed" : "done";
};

/**
 * Files and folders waiting to be uploaded, being uploaded, or done with, independent of any view,
 * so uploads carry on in the background while the user browses. Each file is its own call to the
 * adapter, and so is each folder of a folder uploaded, made before what goes in it, with
 * `MAX_ACTIVE` calls running at once. The item list is replaced, never mutated, so
 * `useSyncExternalStore` can compare it by identity.
 *
 * `onChanged` is told the folders that calls reaching the adapter ended in, done, failed or
 * cancelled, to list them again. It's called at most once every `REPORT_INTERVAL`, so a folder
 * taking many small files isn't listed again for each one.
 */
export const createUploadQueue = (onChanged: (adapter: FileAdapter, folderIds: string[]) => void) => {
    let items: UploadItem[] = [];
    let nextId = 1;
    let active = 0;
    const jobs = new Map<number, Job>();
    const listeners = new Set<() => void>();

    const notify = () => listeners.forEach((listener) => listener());

    // Folders waiting to be reported, by adapter. The first is reported at once, and any that
    // follow within `REPORT_INTERVAL` together at its end.
    const due = new Map<FileAdapter, Set<string>>();
    let timer: number | undefined;

    const report = () => {
        timer = undefined;

        if (due.size === 0) {
            return;
        }

        const reported = [...due];

        due.clear();
        timer = window.setTimeout(report, REPORT_INTERVAL);
        reported.forEach(([adapter, folderIds]) => onChanged(adapter, [...folderIds]));
    };

    const changed = (adapter: FileAdapter, folderIds: (string | undefined)[]) => {
        const ids = due.get(adapter) ?? new Set();

        folderIds.forEach((id) => id !== undefined && ids.add(id));
        due.set(adapter, ids);

        if (timer === undefined) {
            report();
        }
    };

    // The folder a step's call goes to: a file's folder, or the one a folder is made in.
    const targetOf = (job: Job, step: Step) => {
        const holder = step.kind === "file" ? step.into : step.parent;

        return holder ? holder.id : job.item.folder.id;
    };

    // Puts the job's item as it is now in the list.
    const show = (job: Job) => {
        const { id, adapter, folder, conflict } = job.item;
        const status = statusOf(job);
        const error = status === "failed" ? job.error : undefined;

        if (job.upload) {
            let sent = job.doneBytes;

            job.running.forEach((_, step) => {
                sent += step.kind === "file" ? step.file.size * (step.progress ?? 0) : 0;
            });

            job.item = {
                kind: "folder",
                id,
                adapter,
                folder,
                conflict,
                status,
                error,
                name: job.upload.name,
                files: job.root ? job.files.length : undefined,
                size: job.size,
                done: job.doneFiles,
                failed: job.failedFiles,
                skipped: job.skipped,
                progress: job.size > 0 ? sent / job.size : undefined,
            };
        } else {
            const [step] = job.files;

            job.item = {
                kind: "file",
                id,
                adapter,
                folder,
                conflict,
                status,
                error,
                file: step.file,
                progress: step.progress,
            };
        }

        items = items.map((item) => (item.id === id ? job.item : item));
    };

    // Once a folder is made, or listed to merge into, what goes in it can start, its folders first,
    // as they're quick to make, and those a folder merged into has are merged too.
    const opened = (job: Job, folder: FolderStep) => {
        folder.folders.forEach((child) => {
            const there = folder.holds?.get(child.name);

            if (there?.kind === "folder") {
                child.id = there.id;
                child.merge = true;
            }

            job.ready.push(child);
        });
        folder.files.forEach((file) => job.ready.push(file));
    };

    // Readies every step that hasn't been done, from the start or after a failure or a cancel. A
    // folder made already isn't made again, nor a file sent sent again.
    const requeue = (job: Job) => {
        job.ready = [];
        job.next = 0;

        const ready = (step: Step) => {
            step.state = "waiting";

            if (step.kind === "file") {
                step.progress = undefined;
            }

            job.ready.push(step);
        };

        const visit = (folder: FolderStep) => {
            if (folder.state !== "done") {
                ready(folder);

                return;
            }

            folder.folders.forEach(visit);
            folder.files.forEach((file) => file.state !== "done" && ready(file));
        };

        if (job.root) {
            visit(job.root);
        } else if (job.files[0] && job.files[0].state !== "done") {
            ready(job.files[0]);
        }
    };

    const start = (job: Job, step: Step) => {
        const controller = new AbortController();
        const { signal } = controller;
        const { adapter } = job.item;

        job.running.set(step, controller);
        job.started = true;
        step.state = "running";
        active += 1;

        // A cancelled step no longer belongs to its job.
        const owns = () => job.running.get(step) === controller;

        const settle = (error?: unknown) => {
            const failed = error !== undefined;

            if (!owns()) {
                // A folder made after all, once its upload was cancelled, isn't made again.
                if (!failed && step.kind === "folder" && !step.merge && step.state === "waiting") {
                    step.state = "done";
                }

                return;
            }

            job.running.delete(step);
            active -= 1;
            step.state = failed ? "failed" : "done";

            if (failed) {
                job.failures += 1;
                job.failedFiles += step.kind === "file" ? 1 : countFiles(step);
                job.error ??= messageOf(error);
            } else if (step.kind === "file") {
                step.progress = 1;
                job.doneFiles += 1;
                job.doneBytes += step.file.size;
            } else {
                opened(job, step);
            }

            // Listing a folder to merge into changes nothing.
            if (step.kind === "file" || !step.merge) {
                changed(adapter, [targetOf(job, step), step.kind === "folder" ? step.id : undefined]);
            }

            show(job);
            pump();
            notify();
        };

        // Wrapped so an adapter that throws synchronously still ends up as a failure.
        Promise.resolve()
            .then(async () => {
                signal.throwIfAborted();

                // Only the folders in a folder merged into are looked for, to merge them too.
                if (step.kind === "folder" && step.merge) {
                    if (step.folders.length > 0) {
                        step.holds = await listAll(adapter, step.id as string, signal);
                    }

                    return;
                }

                if (step.kind === "folder") {
                    if (!adapter.createFolder) {
                        throw new Error("Not supported here.");
                    }

                    const made = await adapter.createFolder(targetOf(job, step) as string, step.name, { signal });

                    step.id = made.id;

                    return;
                }

                if (!adapter.upload) {
                    throw new Error("Not supported here.");
                }

                // A folder made for the upload has nothing to clash with, and one merged into
                // takes the upload's choice, which merged it.
                await adapter.upload(step.file, targetOf(job, step) as string, {
                    signal,
                    conflict: step.into && !step.into.merge ? "keepBoth" : job.item.conflict,
                    onProgress: (loaded, total) => {
                        if (owns() && total > 0) {
                            step.progress = Math.min(Math.max(loaded / total, 0), 1);
                            show(job);
                            notify();
                        }
                    },
                });
            })
            .then(
                () => settle(),
                // Kept apart from a success even when the adapter rejects with nothing.
                (error: unknown) => settle(error ?? new Error()),
            );

        show(job);
    };

    // Starts steps that can, in the order their uploads were added, while there are free slots.
    const pump = () => {
        for (const job of jobs.values()) {
            while (active < MAX_ACTIVE && job.next < job.ready.length) {
                start(job, job.ready[job.next]);
                job.next += 1;
            }

            if (job.next > 0 && job.next === job.ready.length) {
                job.ready = [];
                job.next = 0;
            }

            if (active >= MAX_ACTIVE) {
                break;
            }
        }
    };

    // Reads a folder upload's folder, then queues what's in it, unless it was cancelled meanwhile.
    const read = (job: Job) => {
        const upload = job.upload as FolderUpload;

        job.reading = true;
        upload.source.read().then(
            (contents) => {
                const found: FileStep[] = [];
                const skipped = { count: 0 };
                const root = toSteps(contents, undefined, job.accepts, found, skipped) as FolderStep;

                root.name = upload.name;
                root.id = upload.mergeInto;
                root.merge = upload.mergeInto !== undefined;
                job.reading = false;
                job.root = root;
                job.files = found;
                job.size = found.reduce((size, step) => size + step.file.size, 0);
                job.skipped = skipped.count;

                if (!job.cancelled) {
                    requeue(job);
                }

                show(job);
                pump();
                notify();
            },
            (error: unknown) => {
                job.reading = false;
                job.failures += 1;
                job.error = messageOf(error);
                show(job);
                notify();
            },
        );
    };

    // Puts a new upload at the end of the queue.
    const enqueue = (job: Omit<Job, "item">, item: UploadItem) => {
        const added: Job = { ...job, item };

        jobs.set(item.id, added);
        items = [...items, item];

        return added;
    };

    const blank = () => ({
        reading: false,
        files: [],
        ready: [],
        next: 0,
        running: new Map(),
        started: false,
        cancelled: false,
        failures: 0,
        failedFiles: 0,
        doneFiles: 0,
        doneBytes: 0,
        size: 0,
        skipped: 0,
    });

    // An upload that reached the adapter may have made the file or folder by the time it's aborted,
    // so the folder it was going into is listed again. What was under way is waiting again, to be
    // tried again.
    const stop = (job: Job) => {
        job.running.forEach((controller, step) => {
            controller.abort();
            step.state = "waiting";

            if (step.kind === "file") {
                step.progress = undefined;
            }

            changed(job.item.adapter, [targetOf(job, step)]);
        });
        active -= job.running.size;
        job.running.clear();
        job.ready = [];
        job.next = 0;
        job.cancelled = true;
        show(job);
    };

    return {
        /** Every upload in the queue, in the order added, ended ones included until `clear`. */
        getItems: () => items,

        subscribe: (listener: () => void) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        /** Queues files to be uploaded into `folder` through `adapter`, which takes uploads. */
        add(adapter: FileAdapter, folder: FolderRef, files: File[], conflict: ConflictPolicy) {
            if (files.length === 0) {
                return;
            }

            files.forEach((file) => {
                const step: FileStep = { kind: "file", file, state: "waiting" };
                const id = nextId++;

                enqueue(
                    { ...blank(), files: [step], ready: [step], size: file.size },
                    { kind: "file", id, file, adapter, folder, conflict, status: "queued" },
                );
            });
            pump();
            notify();
        },

        /**
         * Queues folders to be uploaded into `folder` through `adapter`, which takes uploads and
         * makes folders, each with everything in it, read first. Files `accepts` refuses are left
         * out, and so are folders that held nothing else. With "replace", a folder merged into
         * gets the files with names it has already in their place.
         */
        addFolders(
            adapter: FileAdapter,
            folder: FolderRef,
            folders: FolderUpload[],
            conflict: ConflictPolicy,
            accepts?: (file: File) => boolean,
        ) {
            if (folders.length === 0) {
                return;
            }

            folders.forEach((upload) => {
                const id = nextId++;
                const job = enqueue(
                    { ...blank(), upload, accepts },
                    {
                        kind: "folder",
                        id,
                        adapter,
                        folder,
                        conflict,
                        status: "uploading",
                        name: upload.name,
                        size: 0,
                        done: 0,
                        failed: 0,
                        skipped: 0,
                    },
                );

                read(job);
                show(job);
            });
            pump();
            notify();
        },

        /** Cancels an upload that is waiting or under way. */
        cancel(id: number) {
            const job = jobs.get(id);

            if (job && isActive(job.item)) {
                stop(job);
                pump();
                notify();
            }
        },

        cancelAll() {
            const stopped = [...jobs.values()].filter((job) => isActive(job.item));

            if (stopped.length > 0) {
                stopped.forEach(stop);
                notify();
            }
        },

        /**
         * Queues a failed or cancelled upload again, what of it hadn't been done: a folder's
         * folders made already and files sent already aren't made or sent again.
         */
        retry(id: number) {
            const job = jobs.get(id);

            if (!job || (job.item.status !== "failed" && job.item.status !== "cancelled")) {
                return;
            }

            job.cancelled = false;
            job.started = false;
            job.failures = 0;
            job.failedFiles = 0;
            job.error = undefined;

            if (job.upload && !job.root) {
                // Still being read, once cancelled, or it failed to be.
                if (!job.reading) {
                    read(job);
                }
            } else {
                requeue(job);
            }

            show(job);
            pump();
            notify();
        },

        /** Forgets every upload that has ended, leaving those waiting or under way. */
        clear() {
            const kept = items.filter(isActive);

            if (kept.length !== items.length) {
                items.forEach((item) => !isActive(item) && jobs.delete(item.id));
                items = kept;
                notify();
            }
        },

        /**
         * Cancels every upload, e.g. on unmount, and stops reporting folders. The queue can still
         * be used afterwards.
         */
        abortAll() {
            window.clearTimeout(timer);
            timer = undefined;
            due.clear();
            jobs.forEach((job) => {
                if (isActive(job.item)) {
                    job.running.forEach((controller) => controller.abort());
                    job.running.forEach((_, step) => {
                        step.state = "waiting";
                    });
                    active -= job.running.size;
                    job.running.clear();
                    job.ready = [];
                    job.next = 0;
                    job.cancelled = true;
                    show(job);
                }
            });
            notify();
        },
    };
};

export type UploadQueue = ReturnType<typeof createUploadQueue>;
