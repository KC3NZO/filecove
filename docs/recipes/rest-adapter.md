# An adapter over a REST API

The usual case: your server keeps the files and exposes them over HTTP. This recipe assumes the API below; change the URLs and field names to yours. Every endpoint returns JSON, and errors as `{ "message": "..." }` with a 4xx or 5xx status.

| Endpoint | Returns |
|---|---|
| `GET /api/folders/:id/entries?cursor=` | `{ entries: ApiEntry[], nextCursor?: string, permissions?: {...} }` |
| `POST /api/folders/:id/folders` `{ name }` | `ApiEntry` |
| `PATCH /api/entries/:id` `{ name }` | `ApiEntry` |
| `POST /api/entries/copy` `{ ids, target, conflict }` | `{ entries: ApiEntry[] }` |
| `POST /api/entries/move` `{ ids, target, conflict }` | `{ entries: ApiEntry[] }` |
| `POST /api/entries/delete` `{ ids }` | nothing |
| `POST /api/entries/trash` `{ ids }` | `{ entries: ApiEntry[] }` |
| `POST /api/entries/restore` `{ ids, conflict }` | `{ entries: ApiEntry[] }` |
| `POST /api/folders/:id/files` (multipart `file`, `conflict`) | `ApiEntry` |
| `GET /api/entries/:id/content?download=1` | the bytes, `Content-Disposition: attachment` with `download=1` |
| `GET /api/entries/:id/thumbnail?size=` | an image |
| `POST /api/zip` `{ ids }` | `{ url }`, a temporary URL to the zip |
| `GET /api/search?root=&q=&cursor=&hidden=` | `{ matches: { entry: ApiEntry, trail: {id,name}[] }[], nextCursor? }` |

```ts
interface ApiEntry {
    id: string;
    name: string;
    type: "file" | "folder";
    size?: number;
    mime?: string;
    updated_at?: string;   // ISO
    created_at?: string;
    children?: number;
    has_folders?: boolean;
    permissions?: { write?: boolean; rename?: boolean; move?: boolean; delete?: boolean };
    trashed?: { from: { id: string; name: string }[]; at: string };
}
```

## The adapter

```ts
// rest-adapter.ts
import type { FileAdapter, FileEntry } from "filecove";

const date = (value?: string) => (value ? new Date(value) : undefined);

// Your API's shape to filecove's.
const toEntry = (api: ApiEntry): FileEntry => ({
    id: api.id,
    name: api.name,
    kind: api.type,
    size: api.size,
    mimeType: api.mime,
    modifiedAt: date(api.updated_at),
    createdAt: date(api.created_at),
    childCount: api.children,
    hasSubfolders: api.has_folders,
    permissions: api.permissions,
    trashed: api.trashed && { trail: api.trashed.from, trashedAt: date(api.trashed.at) },
});

export function createRestAdapter(baseUrl = "", headers: Record<string, string> = {}): FileAdapter {
    // One place for fetch, JSON and errors. Rejects with an Error the user can read.
    const request = async <T>(path: string, init: RequestInit & { signal: AbortSignal }): Promise<T> => {
        const response = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers: { "content-type": "application/json", ...headers, ...init.headers },
        });

        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.message ?? `The server answered ${response.status}.`);
        }

        return response.status === 204 ? (undefined as T) : response.json();
    };

    const post = <T>(path: string, body: unknown, signal: AbortSignal) =>
        request<T>(path, { method: "POST", body: JSON.stringify(body), signal });

    const id = (value: string) => encodeURIComponent(value);
    const ids = (entries: FileEntry[]) => entries.map((entry) => entry.id);

    return {
        async list(folderId, { signal, cursor }) {
            const query = cursor ? `?cursor=${id(cursor)}` : "";
            const body = await request<{ entries: ApiEntry[]; nextCursor?: string; permissions?: ApiEntry["permissions"] }>(
                `/api/folders/${id(folderId)}/entries${query}`,
                { signal },
            );
            return { entries: body.entries.map(toEntry), nextCursor: body.nextCursor, permissions: body.permissions };
        },

        async createFolder(parentId, name, { signal }) {
            return toEntry(await post<ApiEntry>(`/api/folders/${id(parentId)}/folders`, { name }, signal));
        },

        async rename(entry, name, { signal }) {
            return toEntry(
                await request<ApiEntry>(`/api/entries/${id(entry.id)}`, { method: "PATCH", body: JSON.stringify({ name }), signal }),
            );
        },

        // Windows-like rules, if your server stores files on a disk that has them.
        checkName(name) {
            if (/[\\:*?"<>|]/.test(name)) return 'A name can\'t contain \\ : * ? " < > |';
            if (name.length > 255) return "That name is too long.";
            return null;
        },

        // Resolving with what was made lets the user undo.
        async copy(entries, targetId, { signal, conflict }) {
            const body = await post<{ entries: ApiEntry[] }>("/api/entries/copy", { ids: ids(entries), target: targetId, conflict }, signal);
            return { entries: body.entries.map(toEntry) };
        },

        async move(entries, targetId, { signal, conflict }) {
            const body = await post<{ entries: ApiEntry[] }>("/api/entries/move", { ids: ids(entries), target: targetId, conflict }, signal);
            return { entries: body.entries.map(toEntry) };
        },

        async delete(entries, { signal }) {
            await post("/api/entries/delete", { ids: ids(entries) }, signal);
        },

        async trash(entries, { signal }) {
            const body = await post<{ entries: ApiEntry[] }>("/api/entries/trash", { ids: ids(entries) }, signal);
            return { entries: body.entries.map(toEntry) };
        },

        async restore(entries, { signal, conflict }) {
            const body = await post<{ entries: ApiEntry[] }>("/api/entries/restore", { ids: ids(entries), conflict }, signal);
            return { entries: body.entries.map(toEntry) };
        },

        // XMLHttpRequest, for upload progress, which fetch can't report.
        upload(file, folderId, { signal, conflict, onProgress }) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const form = new FormData();

                form.append("file", file);
                form.append("conflict", conflict);
                xhr.open("POST", `${baseUrl}/api/folders/${id(folderId)}/files`);
                Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
                xhr.responseType = "json";
                xhr.upload.onprogress = (event) => onProgress(event.loaded, event.total);
                xhr.onload = () =>
                    xhr.status < 300
                        ? resolve(toEntry(xhr.response))
                        : reject(new Error(xhr.response?.message ?? "Couldn't upload the file."));
                xhr.onerror = () => reject(new Error("The connection was lost."));
                signal.addEventListener("abort", () => {
                    xhr.abort();
                    reject(new DOMException("Aborted", "AbortError"));
                });
                xhr.send(form);
            });
        },

        // A URL: the preview streams it, a download saves it.
        async content(entry, { purpose }) {
            const download = purpose === "download" ? "?download=1" : "";
            return { url: `${baseUrl}/api/entries/${id(entry.id)}/content${download}` };
        },

        async download(entries, { signal }) {
            return post<{ url: string }>("/api/zip", { ids: ids(entries) }, signal);
        },

        async thumbnail(entry, { size }) {
            // Answer at once for what can't have one.
            if (!entry.mimeType?.startsWith("image/") && entry.mimeType !== "application/pdf") {
                return null;
            }
            return { url: `${baseUrl}/api/entries/${id(entry.id)}/thumbnail?size=${size}` };
        },

        async search(rootId, query, { signal, cursor, showHidden }) {
            const params = new URLSearchParams({ root: rootId, q: query, hidden: String(showHidden) });
            if (cursor) params.set("cursor", cursor);
            const body = await request<{ matches: { entry: ApiEntry; trail: { id: string; name: string }[] }[]; nextCursor?: string }>(
                `/api/search?${params}`,
                { signal },
            );
            return {
                matches: body.matches.map((match) => ({ entry: toEntry(match.entry), trail: match.trail })),
                nextCursor: body.nextCursor,
            };
        },
    };
}
```

## Using it

```tsx
import { useMemo } from "react";
import { FileManager } from "filecove";
import type { SectionGroup } from "filecove";
import { createRestAdapter } from "./rest-adapter";
import { fileActions } from "./file-actions"; // the set from docs/actions.md

const sections: SectionGroup[] = [
    { id: "places", sections: [{ id: "home", label: "My files", icon: "home", rootId: "root" }] },
    { id: "bin", sections: [{ id: "trash", label: "Trash", icon: "delete", rootId: "trash", trash: true, showFolders: false }] },
];

export function Files({ token }: { token: string }) {
    // A new adapter only when the token changes: a new one resets the file manager.
    const adapter = useMemo(() => createRestAdapter("", { authorization: `Bearer ${token}` }), [token]);

    return (
        <div style={{ height: "100vh" }}>
            <FileManager adapter={adapter} sections={sections} actions={fileActions} />
        </div>
    );
}
```

## Notes

- **Authentication.** URLs handed over from `content` and `thumbnail` are loaded by the browser itself (`<img>`, `<video>`, a new tab), which sends cookies but not an `authorization` header. Either authenticate those endpoints by cookie, sign the URLs (a short-lived token in the query), or fetch the bytes yourself and resolve with `{ blob }`, which works for small files but loses streaming.
- **The server's job** for `"replace"`: replace files of the same name, and merge folders of the same name, all the way down. For `"keepBoth"`: pick a free name, "report (2).pdf". See [The adapter](../adapter.md#name-clashes).
- **Ids with slashes.** `encodeURIComponent` keeps a path id in one URL segment. If your router decodes `%2F`, send ids in the query or the body instead.
- **Big folders.** Return `nextCursor` and the first page shows while the rest comes.
- **Undo.** `copy`, `move`, `trash` and `restore` resolve with what they made, in the order given. If your API returns them in another order, sort them back.
