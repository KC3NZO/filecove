import type { FileContent, FileEntry, PreviewKind, TextExcerpt } from "../types";

/** How much of a text file the preview reads and shows, in bytes. */
export const TEXT_LIMIT = 256_000;

/** How much of a text file is looked through for a NUL byte, which text never holds, as git does. */
const SNIFF_LENGTH = 8_000;

// Only the image formats browsers draw; TIFF, HEIC or PSD would only ever fail to load.
const IMAGE_TYPES = new Set([
    "image/apng",
    "image/avif",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/svg+xml",
    "image/vnd.microsoft.icon",
    "image/webp",
    "image/x-icon",
]);

// MIME types outside `text/` that hold text, besides those ending in "+json" or "+xml".
const TEXT_TYPES = new Set([
    "application/ecmascript",
    "application/graphql",
    "application/javascript",
    "application/json",
    "application/sql",
    "application/toml",
    "application/typescript",
    "application/x-httpd-php",
    "application/x-javascript",
    "application/x-ndjson",
    "application/x-sh",
    "application/x-shellscript",
    "application/x-yaml",
    "application/xml",
    "application/yaml",
]);

const EXTENSIONS: [kind: PreviewKind, extensions: string[]][] = [
    ["image", ["apng", "avif", "bmp", "gif", "ico", "jfif", "jpeg", "jpg", "png", "svg", "webp"]],
    ["video", ["m4v", "mov", "mp4", "ogv", "webm"]],
    ["audio", ["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "weba"]],
    ["pdf", ["pdf"]],
    [
        "text",
        [
            ...["txt", "text", "md", "markdown", "mdx", "rst", "adoc", "log", "csv", "tsv"],
            ...["json", "jsonc", "json5", "ndjson", "xml", "yaml", "yml", "toml", "ini", "cfg", "conf", "env"],
            ...["properties", "lock", "html", "htm", "xhtml", "css", "scss", "sass", "less", "js", "mjs", "cjs"],
            ...["jsx", "ts", "mts", "cts", "tsx", "vue", "svelte", "astro", "graphql", "gql", "sql", "sh"],
            ...["bash", "zsh", "fish", "ps1", "bat", "py", "rb", "php", "pl", "lua", "r", "go", "rs", "java"],
            ...["kt", "kts", "scala", "swift", "dart", "c", "h", "cc", "cpp", "hpp", "cs", "ex", "exs", "erl"],
            ...["hs", "clj", "elm", "gradle", "tf", "hcl", "diff", "patch", "srt", "vtt", "tex"],
        ],
    ],
];

const KINDS_BY_EXTENSION = new Map(
    EXTENSIONS.flatMap(([kind, extensions]) => extensions.map((extension) => [extension, kind] as const)),
);

// Text files known by their whole name, with no extension to go by, or one that says nothing.
const TEXT_NAMES = new Set([
    "dockerfile",
    "gemfile",
    "go.mod",
    "go.sum",
    "license",
    "licence",
    "makefile",
    "procfile",
    "rakefile",
    "readme",
    "vagrantfile",
]);

const kindOfType = (mimeType: string): PreviewKind | undefined => {
    const type = mimeType.split(";")[0].trim().toLowerCase();

    if (type.startsWith("image/")) {
        return IMAGE_TYPES.has(type) ? "image" : "none";
    }

    if (type.startsWith("video/")) {
        return "video";
    }

    if (type.startsWith("audio/")) {
        return "audio";
    }

    if (type === "application/pdf") {
        return "pdf";
    }

    if (type.startsWith("text/") || TEXT_TYPES.has(type) || type.endsWith("+json") || type.endsWith("+xml")) {
        return "text";
    }

    return undefined;
};

/**
 * How the preview shows a file: by its MIME type, or else its name. A web page shows as its source,
 * since running a file's scripts in the page is never safe.
 */
export const previewKind = (entry: FileEntry): PreviewKind => {
    if (entry.kind !== "file") {
        return "none";
    }

    const fromType = entry.mimeType ? kindOfType(entry.mimeType) : undefined;

    if (fromType) {
        return fromType;
    }

    const name = entry.name.toLowerCase();
    const dot = name.lastIndexOf(".");

    // A dotfile, such as .gitignore or .env, holds settings, which are text.
    if (TEXT_NAMES.has(name) || dot === 0) {
        return "text";
    }

    return (dot > 0 && KINDS_BY_EXTENSION.get(name.slice(dot + 1))) || "none";
};

/** A text file's URL answering with an error status, which the preview words in its own language. */
export class ResponseError extends Error {
    readonly status: number;
    readonly statusText: string;

    constructor(response: Response) {
        super(`The server answered ${response.status}${response.statusText && ` ${response.statusText}`}.`);
        this.name = "ResponseError";
        this.status = response.status;
        this.statusText = response.statusText;
    }
}

/** The first `TEXT_LIMIT` bytes at a URL, and whether there were more, reading no further than that. */
const fetchStart = async (url: string, signal: AbortSignal) => {
    const response = await fetch(url, { signal });

    if (!response.ok) {
        throw new ResponseError(response);
    }

    if (!response.body) {
        const all = new Uint8Array(await response.arrayBuffer());

        return { bytes: all.subarray(0, TEXT_LIMIT), truncated: all.length > TEXT_LIMIT };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;

    try {
        while (length <= TEXT_LIMIT) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            length += value.length;
        }
    } finally {
        // Stops the download once enough has come.
        reader.cancel().catch(() => undefined);
    }

    const bytes = new Uint8Array(Math.min(length, TEXT_LIMIT));
    let offset = 0;

    for (const chunk of chunks) {
        const part = chunk.subarray(0, bytes.length - offset);

        bytes.set(part, offset);
        offset += part.length;
    }

    return { bytes, truncated: length > TEXT_LIMIT };
};

/**
 * Reads the start of a text file, at most `TEXT_LIMIT` bytes of it, as UTF-8. Resolves with null
 * for a file that turns out not to be text.
 */
export const readText = async (content: FileContent, signal: AbortSignal): Promise<TextExcerpt | null> => {
    const { bytes, truncated } =
        content.url === undefined
            ? {
                  bytes: new Uint8Array(await content.blob.slice(0, TEXT_LIMIT).arrayBuffer()),
                  truncated: content.blob.size > TEXT_LIMIT,
              }
            : await fetchStart(content.url, signal);

    if (bytes.subarray(0, SNIFF_LENGTH).includes(0)) {
        return null;
    }

    // Cut short, the last character may be missing bytes; streaming leaves it out rather than
    // showing it as a replacement character.
    return { text: new TextDecoder().decode(bytes, { stream: truncated }), truncated };
};
