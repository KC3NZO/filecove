import type { FileAdapter, FileEntry, ListResult } from "../../src";

/** A file or folder of the fake backend, written as nested literals. */
export interface MockNode {
    name: string;
    /** Present on folders, even empty ones. */
    children?: MockNode[];
    size?: number;
    /** ISO date-time. */
    modified?: string;
    mimeType?: string;
    /** Listing this folder fails, to preview the error state. */
    fails?: boolean;
}

interface MockAdapterOptions {
    /** Simulated round-trip time range, in ms. */
    latency?: [min: number, max: number];
}

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
 * renamed folder's id changes along with every id below it. Folders marked `fails` refuse to be
 * listed, renamed or written to.
 */
export const createMockAdapter = (
    roots: Record<string, MockNode[]>,
    { latency = [250, 700] }: MockAdapterOptions = {},
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

    return {
        list: (folderId, { signal }) =>
            respond<ListResult>(signal, () => ({
                entries: (folderAt(folderId).children ?? []).map((child) => toEntry(folderId, child)),
            })),

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
                const parentId = parentOf(entry.id);
                const parent = folderAt(parentId);
                const node = parent.children?.find((child) => child.name === entry.name);

                if (!node) {
                    throw new Error(`No file or folder at ${entry.id}`);
                }

                if (node.fails) {
                    throw new Error("Permission denied");
                }

                ensureFree(parent, name, node);
                node.name = name;

                if (node.children) {
                    unindex(entry.id);
                    index(join(parentId, name), node);
                }

                return toEntry(parentId, node);
            }),
    };
};
