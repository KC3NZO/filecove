import { sampleContent, shrink, thumbnailSource } from "./mock-content";
import { zip } from "./mock-zip";

import type {
    ConflictPolicy,
    FileAdapter,
    FileContent,
    FileEntry,
    FolderRef,
    ListResult,
    SearchMatch,
    SearchResult,
} from "../../src";
import type { ZipItem } from "./mock-zip";

/** A file or folder of the fake backend, written as nested literals. */
export interface MockNode {
    name: string;
    /** Present on folders, even empty ones. */
    children?: MockNode[];
    size?: number;
    /** ISO date-time. */
    modified?: string;
    mimeType?: string;
    /**
     * An uploaded file's bytes, which the preview shows, and the thumbnail when it's a picture;
     * other files get contents made up from their names.
     */
    blob?: Blob;
    /** Listing this folder, or reading this file, fails, to show the error states. */
    fails?: boolean;
}

interface MockAdapterOptions {
    /** Simulated round-trip time range, in ms. */
    latency?: [min: number, max: number];
    /** Entries per page; a larger folder is listed in pages, each a round trip of its own. */
    pageSize?: number;
    /**
     * Files handed over to download as these URLs rather than as bytes, by id, after `delay` ms on
     * top of the latency, as a backend's signed links on another origin would be.
     */
    downloadUrls?: Record<string, { url: string; delay?: number }>;
}

/** How each mock adapter adds a file behind the file manager's back (`addElsewhere`). */
const backDoors = new WeakMap<FileAdapter, (folderId: string) => string | null>();

/**
 * Adds a file to one of a mock adapter's folders without the file manager being told, as another
 * user or another tab would, to see the folder listed again as it opens. Returns the file's name,
 * or null when the folder can't take one.
 */
export const addElsewhere = (adapter: FileAdapter, folderId: string) => backDoors.get(adapter)?.(folderId) ?? null;

/** Results a search hands back a page, so a search matching much of `archive` comes in pages. */
const SEARCH_PAGE = 200;

/** Simulated upload speed, in bytes per second. */
const UPLOAD_SPEED = 5_000_000;

/** Shortest and longest simulated upload, in ms, so small files still show progress and large ones end. */
const UPLOAD_TIME: [min: number, max: number] = [500, 8000];

/** Most files and folders a download packs, so one of `archive` or `datasets` shows the error. */
const DOWNLOAD_LIMIT = 500;

/** Simulated time to pack a download, in ms per file or folder, and the shortest and longest. */
const PACK_TIME_EACH = 40;
const PACK_TIME: [min: number, max: number] = [1500, 6000];

/** Simulated speed a single file is fetched at to be downloaded, in bytes per second. */
const DOWNLOAD_SPEED = 2_000_000;

/** Shortest and longest simulated fetch of a file to download, in ms, so a small one is too quick to show. */
const DOWNLOAD_TIME: [min: number, max: number] = [300, 8000];

export const folder = (name: string, modified: string, children: MockNode[]): MockNode => ({ name, modified, children });

export const file = (name: string, size: number, modified: string, mimeType?: string): MockNode => ({
    name,
    size,
    modified,
    mimeType,
});

/** The id the mock gives an entry named `name` in the folder `parent`: its full path. */
export const childId = (parent: string, name: string) => `${parent.replace(/\/$/, "")}/${name}`;

const parentOf = (path: string) => {
    const cut = path.lastIndexOf("/");

    return cut > 0 ? path.slice(0, cut) : "/";
};

const MARKS = /\p{M}/gu;

/** A name or what's typed with case and accents left out, as the file manager's own folder search folds them. */
const fold = (text: string) => text.toLowerCase().normalize("NFKD").replace(MARKS, "");

const clone = (node: MockNode): MockNode => ({ ...node, children: node.children?.map(clone) });

const clamp = (value: number, [min, max]: [min: number, max: number]) => Math.min(Math.max(value, min), max);

/** Waits `ms`, or rejects as soon as `signal` aborts. */
const wait = (signal: AbortSignal, ms: number) =>
    new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);

            return;
        }

        const timer = setTimeout(resolve, ms);

        signal.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(signal.reason);
            },
            { once: true },
        );
    });

/**
 * Simulates moving `size` bytes over `duration` ms, an upload or a download being prepared,
 * reporting progress as it goes, and rejects as soon as `signal` aborts.
 */
const transfer = (
    signal: AbortSignal,
    size: number,
    duration: number,
    onProgress: (loaded: number, total: number) => void,
) =>
    new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);

            return;
        }

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

/**
 * What a download of `node` packs, named `name`: a file, or a folder and everything in it. What's
 * inside that can't be read is left out, as a backend packing only what the user may read would,
 * and so are dotfiles while hidden files aren't shown.
 */
const packed = (node: MockNode, name: string, showHidden: boolean): { path: string; node: MockNode }[] => {
    if (!node.children) {
        return [{ path: name, node }];
    }

    const inside = `${name}/`;
    const readable = node.children.filter((child) => !child.fails && (showHidden || !child.name.startsWith(".")));

    return [{ path: inside, node }, ...readable.flatMap((child) => packed(child, `${inside}${child.name}`, showHidden))];
};

/** A file's contents: an uploaded file's own bytes, or else contents made up from its name. */
const contentOf = (node: MockNode): FileContent =>
    node.blob ? { blob: node.blob } : sampleContent(node.name, node.size, node.mimeType);

/** A file's bytes, fetched when its contents are a URL, as the videos' are. */
const bytesOf = async (node: MockNode, signal: AbortSignal) => {
    const content = contentOf(node);

    if (content.url === undefined) {
        return content.blob;
    }

    const response = await fetch(content.url, { signal });

    if (!response.ok) {
        throw new Error(`"${node.name}" couldn't be fetched: ${response.status}`);
    }

    return response.blob();
};

const toEntry = (parentPath: string, node: MockNode): FileEntry => ({
    id: childId(parentPath, node.name),
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
    { latency = [250, 700], pageSize = 2500, downloadUrls = {} }: MockAdapterOptions = {},
): FileAdapter => {
    const folders = new Map<string, MockNode>();

    const index = (path: string, node: MockNode) => {
        folders.set(path, node);
        node.children?.forEach((child) => child.children && index(childId(path, child.name), child));
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
            unindex(childId(parentId, node.name));
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
            index(childId(targetId, node.name), node);
        }
    };

    const clashes = (target: MockNode, node: MockNode) => !!target.children?.some((child) => child.name === node.name);

    const adapter: FileAdapter = {
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

        // Every entry below the root whose name holds each word typed, anywhere and in any order,
        // case and accents aside, as the folder search matches, found by walking the tree. Folders
        // that can't be read aren't looked in, and dotfiles and what's in dot folders are left out
        // while hidden files aren't shown. The whole tree is walked for each page, which a backend
        // with an index wouldn't, with the offset of the next page as the cursor.
        search: (rootId, query, { signal, cursor, showHidden }) =>
            respond<SearchResult>(signal, () => {
                const terms = fold(query).split(/\s+/u).filter(Boolean);
                const matches: SearchMatch[] = [];

                const walk = (path: string, node: MockNode, trail: FolderRef[]) => {
                    node.children?.forEach((child) => {
                        if (!showHidden && child.name.startsWith(".")) {
                            return;
                        }

                        const name = fold(child.name);

                        if (terms.length > 0 && terms.every((term) => name.includes(term))) {
                            matches.push({ entry: toEntry(path, child), trail });
                        }

                        if (child.children && !child.fails) {
                            const id = childId(path, child.name);

                            walk(id, child, [...trail, { id, name: child.name }]);
                        }
                    });
                };

                walk(rootId, folderAt(rootId), []);

                const start = cursor ? Number(cursor) : 0;
                const end = start + SEARCH_PAGE;

                return {
                    matches: matches.slice(start, end),
                    nextCursor: end < matches.length ? String(end) : undefined,
                };
            }),

        createFolder: (parentId, name, { signal }) =>
            respond(signal, () => {
                const parent = folderAt(parentId);

                ensureFree(parent, name);

                const node = folder(name, new Date().toISOString(), []);

                parent.children = [...(parent.children ?? []), node];
                index(childId(parentId, name), node);

                return toEntry(parentId, node);
            }),

        rename: (entry, name, { signal }) =>
            respond(signal, () => {
                const { parentId, parent, node } = locate(entry);

                ensureFree(parent, name, node);
                node.name = name;

                if (node.children) {
                    unindex(entry.id);
                    index(childId(parentId, name), node);
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

        // The file itself is kept, for the preview, and its entry handed back, under the name it was
        // kept as. A folder that refuses files does so before anything is sent, and so does a file
        // with "fail" in its name, to show a file failing inside a folder uploaded.
        upload: (file, folderId, { signal, conflict, onProgress }) =>
            Promise.resolve()
                .then(() => {
                    folderAt(folderId);

                    if (/fail/i.test(file.name)) {
                        throw new Error(`The server refused "${file.name}".`);
                    }
                })
                .then(() =>
                    transfer(signal, file.size, clamp((file.size / UPLOAD_SPEED) * 1000, UPLOAD_TIME), onProgress),
                )
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

                        if (conflict === "skip" && clashes(target, node)) {
                            return undefined;
                        }

                        insert(target, folderId, node, conflict);

                        return toEntry(folderId, node);
                    }),
                ),

        // An uploaded file is handed back as it was; the rest get contents made up from their names.
        // To download, a file is handed over as bytes after a simulated fetch at `DOWNLOAD_SPEED`,
        // reporting progress as it goes, as an adapter fetching a blob would, or as its URL in
        // `downloadUrls`. A video's URL, one of MDN's samples, isn't sent as an attachment, so the
        // browser would play it in a tab rather than save it, and it's fetched too.
        content: (entry, { signal, purpose, onProgress }) =>
            respond(signal, () => {
                const { node } = locate(entry);

                if (node.children) {
                    throw new Error(`"${entry.name}" is a folder.`);
                }

                return node;
            }).then(async (node): Promise<FileContent> => {
                if (purpose === "preview") {
                    return contentOf(node);
                }

                const handed = downloadUrls[entry.id];

                if (handed) {
                    await wait(signal, handed.delay ?? 0);

                    return { url: handed.url };
                }

                const size = node.size ?? node.blob?.size ?? 0;

                await transfer(signal, size, clamp((size / DOWNLOAD_SPEED) * 1000, DOWNLOAD_TIME), onProgress);

                return { blob: await bytesOf(node, signal) };
            }),

        // A zip of the entries, folders with everything in them, after a wait that grows with what
        // it holds, as a backend packing one would take, reporting the bytes of the files packed so
        // far, as a backend saying how far it has got would. An entry that can't be read fails it,
        // as `restricted` does, and so does packing more than `DOWNLOAD_LIMIT` files and folders, as
        // `archive`, `datasets` or API service's root would; what can't be read inside a folder is
        // left out, as `docs`' `contract.pdf` is. A folder downloaded from its own menu comes with
        // only its id, which is how a section's root is found. Named after the one entry, or the
        // folder they're in.
        download: (entries, { signal, showHidden, onProgress }) =>
            respond(signal, () => {
                const items = entries.flatMap((entry) =>
                    packed(entry.kind === "folder" ? folderAt(entry.id) : locate(entry).node, entry.name, showHidden),
                );

                if (items.length > DOWNLOAD_LIMIT) {
                    throw new Error(
                        `That's ${items.length} files and folders, more than the ${DOWNLOAD_LIMIT} this server packs at once.`,
                    );
                }

                return items;
            })
                // The files' bytes are gathered first, videos fetched, so the bytes reported while
                // packing are the ones that go in.
                .then((items) =>
                    Promise.all(
                        items.map(
                            async ({ path, node }): Promise<ZipItem> => ({
                                path,
                                data: node.children ? null : await bytesOf(node, signal),
                                modified: node.modified ? new Date(node.modified) : new Date(),
                            }),
                        ),
                    ),
                )
                .then((items) => {
                    const size = items.reduce((sum, item) => sum + (item.data?.size ?? 0), 0);

                    return transfer(signal, size, clamp(items.length * PACK_TIME_EACH, PACK_TIME), onProgress).then(
                        () => zip(items),
                    );
                })
                .then((blob) => {
                    const [first] = entries;
                    const folderName = parentOf(first.id).split("/").filter(Boolean).pop() ?? "download";

                    return { blob, name: `${entries.length === 1 ? first.name : folderName}.zip` };
                }),

        // Made to order, shrunk to the size asked for in either view; a backend keeping a few sizes
        // would pick one by `view`. A file with none is answered at once, without a round trip.
        thumbnail: (entry, { signal, size }) =>
            Promise.resolve()
                .then(() => {
                    const { node } = locate(entry);

                    if (node.blob) {
                        return node.blob.type.startsWith("image/") ? node.blob : null;
                    }

                    return node.children ? null : thumbnailSource(node.name, node.mimeType);
                })
                .then((source) => source && respond(signal, () => source))
                .then((source) => source && shrink(source, size))
                .then((thumbnail) => thumbnail && { blob: thumbnail }),
    };

    backDoors.set(adapter, (folderId) => {
        const target = folders.get(folderId);

        if (!target || target.fails) {
            return null;
        }

        const node = file("Added elsewhere.txt", 1_240, new Date().toISOString(), "text/plain");

        node.name = freeName(target, node);
        target.children = [...(target.children ?? []), node];

        return node.name;
    });

    return adapter;
};
