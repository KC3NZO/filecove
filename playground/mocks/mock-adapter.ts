import { sampleContent } from "./mock-content";

import type { ConflictPolicy, FileAdapter, FileContent, FileEntry, ListResult } from "../../src";

/** A file or folder of the fake backend, written as nested literals. */
export interface MockNode {
    name: string;
    /** Present on folders, even empty ones. */
    children?: MockNode[];
    size?: number;
    /** ISO date-time. */
    modified?: string;
    mimeType?: string;
    /** An uploaded file's bytes, which the preview shows; other files get contents made up from their names. */
    blob?: Blob;
    /** Listing this folder, or reading this file, fails, to show the error states. */
    fails?: boolean;
}

interface MockAdapterOptions {
    /** Simulated round-trip time range, in ms. */
    latency?: [min: number, max: number];
    /** Entries per page; a larger folder is listed in pages, each a round trip of its own. */
    pageSize?: number;
}

/** Simulated upload speed, in bytes per second. */
const UPLOAD_SPEED = 5_000_000;

/** Shortest and longest simulated upload, in ms, so small files still show progress and large ones end. */
const UPLOAD_TIME: [min: number, max: number] = [500, 8000];

export const folder = (name: string, modified: string, children: MockNode[]): MockNode => ({ name, modified, children });

export const file = (name: string, size: number, modified: string, mimeType?: string): MockNode => ({
    name,
    size,
    modified,
    mimeType,
});

const join = (parent: string, name: string) => `${parent.replace(/\/$/, "")}/${name}`;

const parentOf = (path: string) => {
    const cut = path.lastIndexOf("/");

    return cut > 0 ? path.slice(0, cut) : "/";
};

const clone = (node: MockNode): MockNode => ({ ...node, children: node.children?.map(clone) });

const toEntry = (parentPath: string, node: MockNode): FileEntry => ({
    id: join(parentPath, node.name),
    name: node.name,
    kind: node.children ? "folder" : "file",
    size: node.size,
    modifiedAt: node.modified ? new Date(node.modified) : undefined,
    mimeType: node.mimeType,
    childCount: node.fails ? undefined : node.children?.length,
    hasSubfolders: node.fails ? undefined : node.children?.some((child) => child.children),
});

/**
 * An in-memory adapter over one or more unrelated root paths, with simulated latency so the
 * lazy loading can be seen. Entry ids are full paths, as a path-based backend would use, so a
 * renamed folder's id changes along with every id below it. Large folders are listed in pages,
 * with the offset of the next one as the cursor. Files and folders marked `fails` refuse to be
 * listed, read, renamed, deleted or written to.
 */
export const createMockAdapter = (
    roots: Record<string, MockNode[]>,
    { latency = [250, 700], pageSize = 2500 }: MockAdapterOptions = {},
): FileAdapter => {
    const folders = new Map<string, MockNode>();

    const index = (path: string, node: MockNode) => {
        folders.set(path, node);
        node.children?.forEach((child) => child.children && index(join(path, child.name), child));
    };

    // Forgets a folder and everything below it, before it is indexed again under a new path.
    const unindex = (path: string) => {
        [...folders.keys()].forEach((key) => {
            if (key === path || key.startsWith(`${path}/`)) {
                folders.delete(key);
            }
        });
    };

    Object.entries(roots).forEach(([path, children]) => index(path, { name: path, children }));

    /** Settles with what `work` returns, or rejects with what it throws, after the simulated latency. */
    const respond = <T>(signal: AbortSignal, work: () => T) =>
        new Promise<T>((resolve, reject) => {
            const [min, max] = latency;
            const timer = setTimeout(() => {
                try {
                    resolve(work());
                } catch (error) {
                    reject(error);
                }
            }, min + Math.random() * (max - min));

            signal.addEventListener(
                "abort",
                () => {
                    clearTimeout(timer);
                    reject(signal.reason);
                },
                { once: true },
            );
        });

    /** Simulates sending `size` bytes, reporting progress as it goes. */
    const send = (signal: AbortSignal, size: number, onProgress: (loaded: number, total: number) => void) =>
        new Promise<void>((resolve, reject) => {
            if (signal.aborted) {
                reject(signal.reason);

                return;
            }

            const [min, max] = UPLOAD_TIME;
            const duration = Math.min(Math.max((size / UPLOAD_SPEED) * 1000, min), max);
            const started = performance.now();
            const timer = setInterval(() => {
                const done = Math.min((performance.now() - started) / duration, 1);

                onProgress(Math.round(size * done), size);

                if (done === 1) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);

            signal.addEventListener(
                "abort",
                () => {
                    clearInterval(timer);
                    reject(signal.reason);
                },
                { once: true },
            );
        });

    const folderAt = (path: string) => {
        const node = folders.get(path);

        if (!node) {
            throw new Error(`No folder at ${path}`);
        }

        if (node.fails) {
            throw new Error("Permission denied");
        }

        return node;
    };

    const ensureFree = (parent: MockNode, name: string, except?: MockNode) => {
        if (parent.children?.some((child) => child !== except && child.name === name)) {
            throw new Error(`"${name}" already exists.`);
        }
    };

    /** An entry's node and the folder it is in. */
    const locate = (entry: FileEntry) => {
        const parentId = parentOf(entry.id);
        const parent = folderAt(parentId);
        const node = parent.children?.find((child) => child.name === entry.name);

        if (!node) {
            throw new Error(`No file or folder at ${entry.id}`);
        }

        if (node.fails) {
            throw new Error("Permission denied");
        }

        return { parentId, parent, node };
    };

    const detach = (parent: MockNode, parentId: string, node: MockNode) => {
        parent.children = parent.children?.filter((child) => child !== node);

        if (node.children) {
            unindex(join(parentId, node.name));
        }
    };

    // A name the folder doesn't have yet, e.g. "notes (2).txt", for keeping both.
    const freeName = (parent: MockNode, node: MockNode) => {
        const dot = node.children ? -1 : node.name.lastIndexOf(".");
        const [base, extension] = dot > 0 ? [node.name.slice(0, dot), node.name.slice(dot)] : [node.name, ""];
        let name = node.name;

        for (let count = 2; parent.children?.some((child) => child.name === name); count += 1) {
            name = `${base} (${count})${extension}`;
        }

        return name;
    };

    /** Puts a node into a folder, settling a name clash by `conflict`. */
    const insert = (target: MockNode, targetId: string, node: MockNode, conflict: ConflictPolicy) => {
        const existing = target.children?.find((child) => child.name === node.name);

        if (existing && conflict === "replace") {
            detach(target, targetId, existing);
        } else if (existing) {
            node.name = freeName(target, node);
        }

        target.children = [...(target.children ?? []), node];

        if (node.children) {
            index(join(targetId, node.name), node);
        }
    };

    const clashes = (target: MockNode, node: MockNode) => !!target.children?.some((child) => child.name === node.name);

    return {
        list: (folderId, { signal, cursor }) =>
            respond<ListResult>(signal, () => {
                const children = folderAt(folderId).children ?? [];
                const start = cursor ? Number(cursor) : 0;
                const end = start + pageSize;

                return {
                    entries: children.slice(start, end).map((child) => toEntry(folderId, child)),
                    nextCursor: end < children.length ? String(end) : undefined,
                };
            }),

        createFolder: (parentId, name, { signal }) =>
            respond(signal, () => {
                const parent = folderAt(parentId);

                ensureFree(parent, name);

                const node = folder(name, new Date().toISOString(), []);

                parent.children = [...(parent.children ?? []), node];
                index(join(parentId, name), node);

                return toEntry(parentId, node);
            }),

        rename: (entry, name, { signal }) =>
            respond(signal, () => {
                const { parentId, parent, node } = locate(entry);

                ensureFree(parent, name, node);
                node.name = name;

                if (node.children) {
                    unindex(entry.id);
                    index(join(parentId, name), node);
                }

                return toEntry(parentId, node);
            }),

        copy: (entries, targetId, { signal, conflict }) =>
            respond(signal, () => {
                const target = folderAt(targetId);

                entries.forEach((entry) => {
                    const { node } = locate(entry);

                    if (!(conflict === "skip" && clashes(target, node))) {
                        insert(target, targetId, clone(node), conflict);
                    }
                });
            }),

        move: (entries, targetId, { signal, conflict }) =>
            respond(signal, () => {
                const target = folderAt(targetId);

                entries.forEach((entry) => {
                    const { parentId, parent, node } = locate(entry);

                    if (targetId === entry.id || targetId.startsWith(`${entry.id}/`)) {
                        throw new Error(`"${entry.name}" can't go into itself.`);
                    }

                    if (parent === target || (conflict === "skip" && clashes(target, node))) {
                        return;
                    }

                    detach(parent, parentId, node);
                    insert(target, targetId, node, conflict);
                });
            }),

        delete: (entries, { signal }) =>
            respond(signal, () => {
                entries.forEach((entry) => {
                    const { parentId, parent, node } = locate(entry);

                    detach(parent, parentId, node);
                });
            }),

        // The file itself is kept, for the preview. A folder that refuses files does so before
        // anything is sent.
        upload: (file, folderId, { signal, conflict, onProgress }) =>
            Promise.resolve()
                .then(() => folderAt(folderId))
                .then(() => send(signal, file.size, onProgress))
                .then(() =>
                    respond(signal, () => {
                        const target = folderAt(folderId);
                        const node: MockNode = {
                            name: file.name,
                            size: file.size,
                            modified: new Date().toISOString(),
                            mimeType: file.type || undefined,
                            blob: file,
                        };

                        if (!(conflict === "skip" && clashes(target, node))) {
                            insert(target, folderId, node, conflict);
                        }
                    }),
                ),

        // An uploaded file is handed back as it was; the rest get contents made up from their names.
        content: (entry, { signal }) =>
            respond<FileContent>(signal, () => {
                const { node } = locate(entry);

                if (node.children) {
                    throw new Error(`"${entry.name}" is a folder.`);
                }

                return node.blob ? { blob: node.blob } : sampleContent(node.name, node.size, node.mimeType);
            }),
    };
};
