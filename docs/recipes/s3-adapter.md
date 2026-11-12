# An adapter over S3 with presigned URLs

An S3 bucket (or R2, MinIO, any S3-compatible storage) where your server holds the credentials and the browser talks to the bucket directly with URLs your server signs. The bytes never pass through your server; listings and changes do.

Ids are **keys and prefixes**: a file is `photos/2026/beach.jpg`, a folder `photos/2026/` (ending in a slash), and the bucket's root `""`. The file manager never parses them; only this adapter and your server do.

## What your server provides

| Endpoint | Does |
|---|---|
| `GET /api/s3/list?prefix=&cursor=` | `ListObjectsV2` with `Delimiter: "/"`: returns `{ folders: string[], files: { key, size, lastModified }[], nextCursor? }` |
| `POST /api/s3/upload-url` `{ key, type }` | a presigned `PUT` URL for that key |
| `POST /api/s3/download-url` `{ key, attachment }` | a presigned `GET` URL, with `ResponseContentDisposition: attachment` when asked |
| `POST /api/s3/folder` `{ prefix }` | puts an empty object at `prefix` (S3 has no folders; a marker makes an empty one show) |
| `POST /api/s3/delete` `{ keys }` | deletes the keys, and everything under the prefixes among them |
| `POST /api/s3/move` `{ keys, target }` / `/copy` | copies (and for a move deletes) each key, and everything under prefixes, into `target`; returns the new keys |

The bucket's CORS must allow your origin to `PUT` (uploads) and `GET` (the preview's text, and copies to another backend), and expose `ETag`.

## The adapter

```ts
// s3-adapter.ts
import type { FileAdapter, FileEntry } from "filecove";

const nameOf = (key: string) => key.replace(/\/$/, "").split("/").pop() ?? key;
const isFolder = (key: string) => key.endsWith("/");

const toEntry = (key: string, size?: number, lastModified?: string): FileEntry => ({
    id: key,
    name: nameOf(key),
    kind: isFolder(key) ? "folder" : "file",
    size,
    modifiedAt: lastModified ? new Date(lastModified) : undefined,
});

async function api<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
    const response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        throw new Error((await response.json().catch(() => null))?.message ?? "The storage didn't answer.");
    }

    return response.json();
}

export const s3Adapter: FileAdapter = {
    async list(prefix, { signal, cursor }) {
        const params = new URLSearchParams({ prefix });
        if (cursor) params.set("cursor", cursor);

        const body = await api<{ folders: string[]; files: { key: string; size: number; lastModified: string }[]; nextCursor?: string }>(
            `/api/s3/list?${params}`,
            undefined,
            signal,
        );

        return {
            entries: [
                ...body.folders.map((key) => toEntry(key)),
                // The folder's own marker object is listed under its prefix; leave it out.
                ...body.files.filter((file) => file.key !== prefix).map((file) => toEntry(file.key, file.size, file.lastModified)),
            ],
            nextCursor: body.nextCursor,
        };
    },

    async createFolder(parentPrefix, name, { signal }) {
        const prefix = `${parentPrefix}${name}/`;
        await api("/api/s3/folder", { prefix }, signal);
        return toEntry(prefix);
    },

    // S3 keys can hold almost anything, but "/" makes a folder.
    checkName(name) {
        return new TextEncoder().encode(name).length > 900 ? "That name is too long." : null;
    },

    async copy(entries, target, { signal }) {
        const { keys } = await api<{ keys: string[] }>("/api/s3/copy", { keys: entries.map((entry) => entry.id), target }, signal);
        return { entries: keys.map((key, index) => ({ ...entries[index], id: key, name: nameOf(key) })) };
    },

    async move(entries, target, { signal }) {
        const { keys } = await api<{ keys: string[] }>("/api/s3/move", { keys: entries.map((entry) => entry.id), target }, signal);
        return { entries: keys.map((key, index) => ({ ...entries[index], id: key, name: nameOf(key) })) };
    },

    async delete(entries, { signal }) {
        await api("/api/s3/delete", { keys: entries.map((entry) => entry.id) }, signal);
    },

    async upload(file, prefix, { signal, onProgress }) {
        const key = `${prefix}${file.name}`;
        const { url } = await api<{ url: string }>("/api/s3/upload-url", { key, type: file.type }, signal);

        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", url);
            xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
            xhr.upload.onprogress = (event) => onProgress(event.loaded, event.total);
            xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("The storage refused the file.")));
            xhr.onerror = () => reject(new Error("The connection was lost."));
            signal.addEventListener("abort", () => {
                xhr.abort();
                reject(new DOMException("Aborted", "AbortError"));
            });
            xhr.send(file);
        });

        return { id: key, name: file.name, kind: "file", size: file.size, mimeType: file.type, modifiedAt: new Date() };
    },

    async content(entry, { signal, purpose }) {
        const { url } = await api<{ url: string }>(
            "/api/s3/download-url",
            { key: entry.id, attachment: purpose === "download" },
            signal,
        );
        return { url };
    },
};
```

## Notes

- **Name clashes.** A `PUT` to a key that exists replaces it. This upload ignores `conflict`, so it always replaces; to keep both, have `/api/s3/upload-url` pick a free key ("beach (2).jpg") when asked with `conflict: "keepBoth"` and return it, then resolve with that key. The file manager asks the user first about the names it can see, so a clash only reaches the adapter when the folder changed meanwhile.
- **Renaming** is a copy and a delete on S3, and for a folder, of everything under it. Add `rename` through your server the same way as `move`, if you want it; without it, there's no Rename.
- **Downloads.** `attachment: true` makes the signed URL answer with `Content-Disposition: attachment`, so the browser saves it rather than opening it in the tab the file manager opens for another origin. Zipping a folder needs a server (or a worker) to build the zip: add `download` returning its URL.
- **Thumbnails.** S3 makes none. Generate them on upload (a Lambda, a queue) under a `thumbnails/` prefix, and add `thumbnail` returning their signed URLs, `null` for files that have none.
- **Folders that hold nothing but a marker** show as empty folders. Folders made implicitly by keys (`a/b/c.txt` with no `a/` object) show too, from `CommonPrefixes`.
- **Search.** S3 can't search. Keep an index (your database, OpenSearch) and add `search`, or leave it out: the open folder's own search still works.
