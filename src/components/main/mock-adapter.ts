import type { FileAdapter, FileEntry, ListResult } from "../file-manager";

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
 * lazy loading can be seen. Entry ids are full paths, as a path-based backend would use.
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

    Object.entries(roots).forEach(([path, children]) => index(path, { name: path, children }));

    return {
        list: (folderId, { signal }) =>
            new Promise<ListResult>((resolve, reject) => {
                const [min, max] = latency;
                const timer = setTimeout(() => {
                    const node = folders.get(folderId);

                    if (!node) {
                        reject(new Error(`No folder at ${folderId}`));
                    } else if (node.fails) {
                        reject(new Error("Permission denied"));
                    } else {
                        resolve({ entries: (node.children ?? []).map((child) => toEntry(folderId, child)) });
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
            }),
    };
};
