import { sampleContent, shrink, thumbnailSource } from "./mock-content";
import { zip } from "./mock-zip";

import type {
    ConflictPolicy,
    EntryPermissions,
    EntryProperties,
    EntryTotals,
    FileAdapter,
    FileContent,
    FileEntry,
    FolderRef,
    ListResult,
    MediaInfo,
    PropertyGroup,
    SearchMatch,
    SearchResult,
    TransferOptions,
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
    /**
     * This folder or file, and everything in it, can't be changed: its entries say so in their
     * `permissions`, and the adapter refuses changing them anyway, as a backend would.
     */
    readOnly?: boolean;
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
    /** Names are held to Windows' rules, as a server sharing its folders over SMB would hold them. */
    windowsNames?: boolean;
}

// Windows refuses these characters, and control characters, anywhere in a name.
const WINDOWS_FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/;
// Device names, with any extension ("con.txt" too), whatever their case.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Why Windows wouldn't take a name, or undefined when it would. */
const windowsNameProblem = (name: string) => {
    const forbidden = WINDOWS_FORBIDDEN.exec(name)?.[0];

    if (forbidden) {
        return forbidden < " " ? "Names can't contain control characters." : `Names can't contain "${forbidden}".`;
    }

    if (WINDOWS_RESERVED.test(name)) {
        return `"${name.split(".")[0]}" is reserved by Windows.`;
    }

    if (/[. ]$/.test(name)) {
        return "Names can't end with a dot or a space.";
    }

    if (name.length > 255) {
        return "Names can be 255 characters at most.";
    }

    return undefined;
};

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

/** How many entries counting what's in folders goes through between reports of how far it got. */
const COUNT_STEP = 250;

/** Simulated time each step of counting what's in folders takes, in ms. */
const COUNT_STEP_TIME = 40;

/** Simulated speed a single file is fetched at to be downloaded, in bytes per second. */
const DOWNLOAD_SPEED = 2_000_000;

/** Shortest and longest simulated fetch of a file to download, in ms, so a small one is too quick to show. */
const DOWNLOAD_TIME: [min: number, max: number] = [300, 8000];

/** Simulated speed of copying, and of moving between roots, in bytes per second. */
const COPY_SPEED = 8_000_000;

/** Shortest and longest simulated copy, in ms, so a small one is too quick to show, and a large one ends. */
const COPY_TIME: [min: number, max: number] = [250, 10_000];

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

// A copy is the copier's, so it can be changed, even when what it was copied from can't.
const clone = (node: MockNode): MockNode => ({ ...node, readOnly: undefined, children: node.children?.map(clone) });

/** What an entry that can't be changed allows: nothing but reading. */
const READ_ONLY: EntryPermissions = { write: false, rename: false, move: false, delete: false };

/** How many bytes a file is, or everything in a folder. */
const sizeOf = (node: MockNode): number =>
    node.children ? node.children.reduce((sum, child) => sum + sizeOf(child), 0) : (node.size ?? 0);

/** Something below a folder that can't be read, which stops a copy of it partway. */
const unreadableIn = (node: MockNode): MockNode | undefined =>
    node.children?.reduce<MockNode | undefined>(
        (found, child) => found ?? (child.fails ? child : unreadableIn(child)),
        undefined,
    );

/** A number made from a text, the same for the same text, for properties made up from names. */
const hashOf = (text: string) => [...text].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7);

const extensionOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

const IMAGE_SIZES: [width: number, height: number][] = [
    [1920, 1080],
    [1600, 1200],
    [1280, 720],
    [2048, 2048],
    [1080, 1350],
];

/**
 * What a picture, a video or a piece of audio is like, made up from its name, as a backend reading
 * the files would know it. An uploaded picture's isn't known, as it isn't read.
 */
const mediaOf = (node: MockNode): MediaInfo | undefined => {
    const type = node.mimeType ?? "";
    const extension = extensionOf(node.name);
    const hash = hashOf(node.name);

    if (node.children || node.blob) {
        return undefined;
    }

    if (type === "image/svg+xml" || extension === "svg") {
        return { width: 512, height: 512 };
    }

    if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
        const [width, height] = IMAGE_SIZES[hash % IMAGE_SIZES.length];

        return { width, height };
    }

    if (type.startsWith("video/") || ["mp4", "webm", "mov"].includes(extension)) {
        return extension === "webm"
            ? { width: 1280, height: 720, duration: 32 }
            : { width: 1920, height: 1080, duration: 120 + (hash % 600) };
    }

    if (type.startsWith("audio/") || ["mp3", "wav", "ogg", "flac"].includes(extension)) {
        return { duration: 60 + (hash % 240) };
    }

    return undefined;
};

/** A checksum made up from the id, 64 hexadecimal digits, as a SHA-256 is written. */
const checksumOf = (id: string) => {
    let seed = hashOf(id);

    return Array.from({ length: 64 }, () => {
        seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;

        return (seed >>> 24).toString(16).padStart(2, "0").slice(-1);
    }).join("");
};

const TAGS = ["draft", "reviewed", "client", "internal", "final", "archive"];

/** Who owns what's below each root, in the order the roots are given. */
const OWNERS = ["you", "deploy-bot", "Design team"];

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
 * Simulates moving `size` bytes over `duration` ms, an upload, a download being prepared or a
 * copy, reporting progress as it goes, and rejects as soon as `signal` aborts.
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
const contentOf = async (node: MockNode): Promise<FileContent> =>
    node.blob ? { blob: node.blob } : sampleContent(node.name, node.size, node.mimeType);

/** A file's bytes, fetched when its contents are a URL, as the videos' and fonts' are. */
const bytesOf = async (node: MockNode, signal: AbortSignal) => {
    const content = await contentOf(node);

    if (content.url === undefined) {
        return content.blob;
    }

    const response = await fetch(content.url, { signal });

    if (!response.ok) {
        throw new Error(`"${node.name}" couldn't be fetched: ${response.status}`);
    }

    return response.blob();
};

// `locked` is whether the folder it's in can't be changed, which nothing in it can be then.
const toEntry = (parentPath: string, node: MockNode, locked: boolean): FileEntry => ({
    id: childId(parentPath, node.name),
    name: node.name,
    kind: node.children ? "folder" : "file",
    size: node.size,
    modifiedAt: node.modified ? new Date(node.modified) : undefined,
    mimeType: node.mimeType,
    childCount: node.fails ? undefined : node.children?.length,
    hasSubfolders: node.fails ? undefined : node.children?.some((child) => child.children),
    permissions: locked || node.readOnly ? READ_ONLY : undefined,
});

/**
 * An in-memory adapter over one or more unrelated root paths, with simulated latency so the
 * lazy loading can be seen. Entry ids are full paths, as a path-based backend would use, so a
 * renamed folder's id changes along with every id below it. Large folders are listed in pages,
 * with the offset of the next one as the cursor. Files and folders marked `fails` refuse to be
 * listed, read, renamed, deleted or written to, and those marked `readOnly`, with everything in
 * them, say so in their permissions and refuse to be changed. With `windowsNames`, names Windows
 * wouldn't take are refused, and said so as they're typed (`checkName`).
 */
export const createMockAdapter = (
    roots: Record<string, MockNode[]>,
    { latency = [250, 700], pageSize = 2500, downloadUrls = {}, windowsNames = false }: MockAdapterOptions = {},
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

    /** Whether the folder or file at `path`, or a folder it's in, can't be changed. */
    const locked = (path: string) => {
        for (let at = path; ; at = parentOf(at)) {
            if (folders.get(at)?.readOnly) {
                return true;
            }

            if (at === "/") {
                return false;
            }
        }
    };

    /** A folder to change what's in it: refused when it can't be changed. */
    const writableAt = (path: string) => {
        const node = folderAt(path);

        if (locked(path)) {
            throw new Error("This folder is read-only.");
        }

        return node;
    };

    /** Refuses a name the backend's rules don't allow, as `checkName` says before it's sent. */
    const ensureAllowed = (name: string) => {
        const problem = windowsNames ? windowsNameProblem(name) : undefined;

        if (problem) {
            throw new Error(problem);
        }
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

    /** An entry's node and the folder it is in, to rename, move or delete it: refused when it can't be changed. */
    const locateChangeable = (entry: FileEntry) => {
        const located = locate(entry);

        if (located.node.readOnly || locked(located.parentId)) {
            throw new Error(`“${entry.name}” is read-only.`);
        }

        return located;
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

    /**
     * Puts a node into a folder, settling a name clash by `conflict`. "replace" puts a file in the
     * place of a file, and merges a folder into a folder, what's in it going in the same way; a file
     * and a folder never take each other's place, nor does anything take the place of, or merge
     * into, what's read-only, and those are kept both.
     */
    const insert = (target: MockNode, targetId: string, node: MockNode, conflict: ConflictPolicy) => {
        const existing = target.children?.find((child) => child.name === node.name);
        const replacing = conflict === "replace" && !!existing && !existing.readOnly;

        if (existing?.children && node.children && replacing) {
            if (existing.fails) {
                throw new Error("Permission denied");
            }

            const existingId = childId(targetId, existing.name);

            node.children.forEach((child) => insert(existing, existingId, child, "replace"));

            return;
        }

        if (existing && replacing && !existing.children === !node.children) {
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

    /**
     * Copies or moves entries into a folder at `COPY_SPEED`, reporting how far it has got, as a
     * backend copying the bytes would. Something below an entry that can't be read stops it halfway
     * through that entry, with the entries before it done, as a backend failing partway leaves them.
     * `put` puts each entry where it goes once its bytes have come.
     */
    const carry = async (
        entries: FileEntry[],
        targetId: string,
        { signal, conflict, onProgress }: TransferOptions,
        put: (target: MockNode, located: ReturnType<typeof locate>) => void,
        find: (entry: FileEntry) => ReturnType<typeof locate> = locate,
    ) => {
        const target = writableAt(targetId);
        const located = entries.map(find).filter(({ node }) => !(conflict === "skip" && clashes(target, node)));
        const sizes = located.map(({ node }) => sizeOf(node));
        const total = sizes.reduce((sum, size) => sum + size, 0);
        const stuckAt = located.findIndex(({ node }) => unreadableIn(node));
        const done = stuckAt < 0 ? located : located.slice(0, stuckAt);
        const reached =
            stuckAt < 0 ? total : sizes.slice(0, stuckAt).reduce((sum, size) => sum + size, 0) + sizes[stuckAt] / 2;
        const duration = clamp((total / COPY_SPEED) * 1000, COPY_TIME);

        await transfer(signal, reached, total > 0 ? (duration * reached) / total : duration, (loaded) =>
            onProgress(loaded, total),
        );
        done.forEach((item) => put(target, item));

        if (stuckAt >= 0) {
            throw new Error(`Couldn't read “${unreadableIn(located[stuckAt].node)?.name}”.`);
        }
    };

    // The root a path is below, which says who owns it.
    const rootOf = (path: string) =>
        Object.keys(roots).find((root) => path === root || path.startsWith(root === "/" ? "/" : `${root}/`)) ?? "/";

    const adapter: FileAdapter = {
        list: (folderId, { signal, cursor }) =>
            respond<ListResult>(signal, () => {
                const children = folderAt(folderId).children ?? [];
                const start = cursor ? Number(cursor) : 0;
                const end = start + pageSize;
                const lockedHere = locked(folderId);

                return {
                    entries: children.slice(start, end).map((child) => toEntry(folderId, child, lockedHere)),
                    nextCursor: end < children.length ? String(end) : undefined,
                    // Read-only folders say so with their listing, which is how a root does.
                    permissions: lockedHere ? READ_ONLY : undefined,
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

                const walk = (path: string, node: MockNode, trail: FolderRef[], lockedHere: boolean) => {
                    node.children?.forEach((child) => {
                        if (!showHidden && child.name.startsWith(".")) {
                            return;
                        }

                        const name = fold(child.name);

                        if (terms.length > 0 && terms.every((term) => name.includes(term))) {
                            matches.push({ entry: toEntry(path, child, lockedHere), trail });
                        }

                        if (child.children && !child.fails) {
                            const id = childId(path, child.name);

                            walk(id, child, [...trail, { id, name: child.name }], lockedHere || !!child.readOnly);
                        }
                    });
                };

                walk(rootId, folderAt(rootId), [], locked(rootId));

                const start = cursor ? Number(cursor) : 0;
                const end = start + SEARCH_PAGE;

                return {
                    matches: matches.slice(start, end),
                    nextCursor: end < matches.length ? String(end) : undefined,
                };
            }),

        // An entry's properties as a backend keeps them: when it was made, and what a picture, a
        // video or a piece of audio is like, which listings leave out, made up from its name, with
        // its owner, its permissions, its path, a checksum for a file, a link to share it and some
        // tags. What can't be read fails, as `restricted` and `contract.pdf` do. A folder may come
        // with only its id, as a section's root does.
        properties: (entry, { signal }) =>
            respond<EntryProperties>(signal, () => {
                const node = entry.kind === "folder" ? folderAt(entry.id) : locate(entry).node;
                const hash = hashOf(entry.id);
                const root = rootOf(entry.id);
                const made = node.modified
                    ? new Date(new Date(node.modified).getTime() - ((hash % 120) + 1) * 86_400_000)
                    : undefined;
                const code = (hash % 46_656).toString(36).padStart(3, "0");
                const tags = TAGS.filter((_, index) => (hash >>> (index * 3)) % 4 === 0).slice(0, 3);
                const groups: PropertyGroup[] = [
                    {
                        id: "access",
                        fields: [
                            {
                                id: "owner",
                                label: "Owner",
                                type: "text",
                                value: OWNERS[Math.max(Object.keys(roots).indexOf(root), 0) % OWNERS.length],
                            },
                            {
                                id: "permissions",
                                label: "Permissions",
                                type: "text",
                                value: node.readOnly || locked(entry.id) ? "Read only" : "Read and write",
                            },
                            { id: "path", label: "Path", type: "text", value: entry.id, copyable: true },
                        ],
                    },
                ];

                if (!node.children) {
                    groups.push({
                        id: "integrity",
                        title: "Integrity",
                        fields: [
                            {
                                id: "sha256",
                                label: "SHA-256",
                                type: "text",
                                value: checksumOf(entry.id),
                                copyable: true,
                            },
                        ],
                    });
                }

                groups.push({
                    id: "sharing",
                    title: "Sharing",
                    fields: [
                        {
                            id: "link",
                            label: "Link",
                            type: "link",
                            value: `files.example.com/s/${code}`,
                            href: `https://files.example.com/s/${code}`,
                        },
                        { id: "views", label: "Views", type: "number", value: 12 + (hash % 9000) },
                    ],
                });

                if (tags.length > 0) {
                    groups.push({ id: "labels", fields: [{ id: "tags", label: "Tags", type: "tags", value: tags }] });
                }

                return { entry: { ...entry, createdAt: made, media: mediaOf(node) }, groups };
            }),

        // Counts what's in folders by walking the tree, `COUNT_STEP` entries a step, reporting the
        // totals so far after each, as a backend walking a bucket's keys a page at a time would, so
        // `archive` and API service's root count up. Folders that can't be read are counted but not
        // looked in, and dotfiles and what's in dot folders are left out while hidden files aren't
        // shown. A folder that can't be read itself fails it, as `restricted` does.
        measure: (entries, { signal, showHidden, onProgress }) =>
            respond(signal, () => entries.map((entry) => folderAt(entry.id))).then(async (nodes) => {
                const totals: EntryTotals = { files: 0, folders: 0, size: 0 };
                const waiting = [...nodes];
                let counted = 0;

                for (let node = waiting.pop(); node; node = waiting.pop()) {
                    for (const child of node.children ?? []) {
                        if (!showHidden && child.name.startsWith(".")) {
                            continue;
                        }

                        if (child.children) {
                            totals.folders += 1;

                            if (!child.fails) {
                                waiting.push(child);
                            }
                        } else {
                            totals.files += 1;
                            totals.size += child.size ?? child.blob?.size ?? 0;
                        }

                        counted += 1;

                        if (counted % COUNT_STEP === 0) {
                            onProgress({ ...totals });
                            await wait(signal, COUNT_STEP_TIME);
                        }
                    }
                }

                return totals;
            }),

        // Held to Windows' rules when asked, which `createFolder`, `rename` and `upload` enforce too.
        checkName: windowsNames ? (name) => windowsNameProblem(name) : undefined,

        createFolder: (parentId, name, { signal }) =>
            respond(signal, () => {
                const parent = writableAt(parentId);

                ensureAllowed(name);
                ensureFree(parent, name);

                const node = folder(name, new Date().toISOString(), []);

                parent.children = [...(parent.children ?? []), node];
                index(childId(parentId, name), node);

                return toEntry(parentId, node, false);
            }),

        rename: (entry, name, { signal }) =>
            respond(signal, () => {
                const { parentId, parent, node } = locateChangeable(entry);

                ensureAllowed(name);
                ensureFree(parent, name, node);
                node.name = name;

                if (node.children) {
                    unindex(entry.id);
                    index(childId(parentId, name), node);
                }

                return toEntry(parentId, node, false);
            }),

        copy: (entries, targetId, options) =>
            carry(entries, targetId, options, (target, { node }) =>
                insert(target, targetId, clone(node), options.conflict),
            ),

        // Within a root, a move only renames, at once; between roots, the bytes go as a copy's do.
        move: (entries, targetId, options) => {
            const { signal, conflict } = options;
            const into = entries.find((entry) => targetId === entry.id || targetId.startsWith(`${entry.id}/`));

            if (into) {
                return Promise.reject(new Error(`"${into.name}" can't go into itself.`));
            }

            const put = (target: MockNode, { parentId, parent, node }: ReturnType<typeof locate>) => {
                detach(parent, parentId, node);
                insert(target, targetId, node, conflict);
            };

            if (entries.some((entry) => rootOf(entry.id) !== rootOf(targetId))) {
                return carry(entries, targetId, options, put, locateChangeable);
            }

            return respond(signal, () => {
                const target = writableAt(targetId);

                entries.forEach((entry) => {
                    const located = locateChangeable(entry);

                    if (located.parent !== target && !(conflict === "skip" && clashes(target, located.node))) {
                        put(target, located);
                    }
                });
            });
        },

        delete: (entries, { signal }) =>
            respond(signal, () => {
                entries.forEach((entry) => {
                    const { parentId, parent, node } = locateChangeable(entry);

                    detach(parent, parentId, node);
                });
            }),

        // The file itself is kept, for the preview, and its entry handed back, under the name it was
        // kept as. A folder that refuses files does so before anything is sent, and so does a file
        // with "fail" in its name, to show a file failing inside a folder uploaded.
        upload: (file, folderId, { signal, conflict, onProgress }) =>
            Promise.resolve()
                .then(() => {
                    writableAt(folderId);
                    ensureAllowed(file.name);

                    if (/fail/i.test(file.name)) {
                        throw new Error(`The server refused "${file.name}".`);
                    }
                })
                .then(() =>
                    transfer(signal, file.size, clamp((file.size / UPLOAD_SPEED) * 1000, UPLOAD_TIME), onProgress),
                )
                .then(() =>
                    respond(signal, () => {
                        const target = writableAt(folderId);
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

                        return toEntry(folderId, node, false);
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
