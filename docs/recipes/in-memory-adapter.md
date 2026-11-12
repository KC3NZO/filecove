# An in-memory adapter

A complete adapter over a tree kept in memory: listing, new folders, renames, copies, moves, deletes, uploads and the preview, all undoable. Use it to try filecove out before your backend is ready, in Storybook, or in tests. Everything is lost on reload.

Ids are generated, not paths, which is how most databases work; the file manager doesn't care either way.

```ts
// memory-adapter.ts
import type { FileAdapter, FileEntry, TransferResult } from "filecove";

interface Node {
    entry: FileEntry;
    parentId: string | null;
    blob?: Blob;
}

const abortable = (signal: AbortSignal) => {
    if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
    }
};

export function createMemoryAdapter(): FileAdapter {
    const nodes = new Map<string, Node>();
    let next = 1;

    const add = (parentId: string | null, entry: Omit<FileEntry, "id">, blob?: Blob): FileEntry => {
        const made: FileEntry = { ...entry, id: `n${next++}`, modifiedAt: new Date() };
        nodes.set(made.id, { entry: made, parentId, blob });
        return made;
    };

    const childrenOf = (parentId: string) => [...nodes.values()].filter((node) => node.parentId === parentId);

    const freeName = (parentId: string, name: string) => {
        const taken = new Set(childrenOf(parentId).map((node) => node.entry.name));
        if (!taken.has(name)) return name;
        const dot = name.lastIndexOf(".");
        const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
        for (let n = 2; ; n++) {
            const candidate = `${base} (${n})${ext}`;
            if (!taken.has(candidate)) return candidate;
        }
    };

    const remove = (id: string) => {
        childrenOf(id).forEach((child) => remove(child.entry.id));
        nodes.delete(id);
    };

    const copyInto = (node: Node, parentId: string): FileEntry => {
        const made = add(parentId, { ...node.entry, name: freeName(parentId, node.entry.name) }, node.blob);
        childrenOf(node.entry.id).forEach((child) => copyInto(child, made.id));
        return made;
    };

    // The root.
    nodes.set("root", { entry: { id: "root", name: "Files", kind: "folder" }, parentId: null });
    const docs = add("root", { name: "Documents", kind: "folder" });
    add(docs.id, { name: "notes.txt", kind: "file", mimeType: "text/plain" }, new Blob(["Hello from memory."]));
    add("root", { name: "Pictures", kind: "folder" });

    return {
        async list(folderId, { signal }) {
            abortable(signal);
            if (!nodes.has(folderId)) throw new Error("This folder doesn't exist any more.");
            return { entries: childrenOf(folderId).map((node) => node.entry) };
        },

        async createFolder(parentId, name) {
            if (childrenOf(parentId).some((node) => node.entry.name === name)) {
                throw new Error(`There's already something named “${name}” here.`);
            }
            return add(parentId, { name, kind: "folder" });
        },

        async rename(entry, name) {
            const node = nodes.get(entry.id);
            if (!node) throw new Error("It doesn't exist any more.");
            node.entry = { ...node.entry, name, modifiedAt: new Date() };
            return node.entry;
        },

        async copy(entries, targetId): Promise<TransferResult> {
            return { entries: entries.map((entry) => copyInto(nodes.get(entry.id)!, targetId)) };
        },

        async move(entries, targetId, { conflict, onEntryDone }): Promise<TransferResult> {
            const made = entries.map((entry) => {
                const node = nodes.get(entry.id)!;
                const name = conflict === "keepBoth" ? freeName(targetId, node.entry.name) : node.entry.name;
                node.parentId = targetId;
                node.entry = { ...node.entry, name };
                onEntryDone(entry, node.entry);
                return node.entry;
            });
            return { entries: made };
        },

        async delete(entries) {
            entries.forEach((entry) => remove(entry.id));
        },

        async upload(file, folderId, { conflict, signal }) {
            abortable(signal);
            const existing = childrenOf(folderId).find((node) => node.entry.name === file.name);
            if (existing && conflict === "skip") return; // left out
            if (existing && conflict === "replace" && existing.entry.kind === "file") {
                existing.blob = file;
                existing.entry = { ...existing.entry, size: file.size, modifiedAt: new Date() };
                return existing.entry;
            }
            return add(folderId, { name: freeName(folderId, file.name), kind: "file", size: file.size, mimeType: file.type }, file);
        },

        async content(entry) {
            const blob = nodes.get(entry.id)?.blob;
            if (!blob) throw new Error("This file has no contents.");
            return { blob };
        },
    };
}
```

```tsx
import { useMemo } from "react";
import { FileManager } from "filecove";
import type { SectionGroup } from "filecove";
import { createMemoryAdapter } from "./memory-adapter";
import { fileActions } from "./file-actions"; // the set from docs/actions.md

const sections: SectionGroup[] = [{ id: "places", sections: [{ id: "files", label: "Files", icon: "home", rootId: "root" }] }];

export function Playground() {
    const adapter = useMemo(createMemoryAdapter, []);

    return (
        <div style={{ height: "100vh" }}>
            <FileManager adapter={adapter} sections={sections} actions={fileActions} />
        </div>
    );
}
```

Notes:

- `copy`, `move` and `upload` resolve with what they made, so copies and moves can be undone and an uploaded file kept under another name is found.
- `move` keeps it simple: a real backend would merge folders on `"replace"` (see [The adapter](../adapter.md#name-clashes)).
- To see loading states, add a delay at the top of `list`: `await new Promise((resolve) => setTimeout(resolve, 300));`.
