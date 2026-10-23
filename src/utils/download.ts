import type { DownloadItem, FileAdapter, FileEntry, FolderRef, PreparedDownload } from "../types";

/** How long a blob's object URL is kept once its download has started, while the browser may still be reading it. */
const REVOKE_AFTER = 60_000;

/**
 * What's downloaded for `entries` in `folder`: the entries, or with none, the folder itself, as an
 * entry with only what's known of it, as from its own menu.
 */
export const downloadedEntries = (entries: readonly FileEntry[], folder: FolderRef): FileEntry[] =>
    entries.length > 0 ? [...entries] : [{ id: folder.id, name: folder.name, kind: "folder" }];

/**
 * Whether the adapter can hand `entries` over as one file to save: a single file through `content`
 * or `download`, and anything else through `download`.
 */
export const canDownload = (adapter: FileAdapter, entries: readonly FileEntry[]) =>
    entries.length > 0 &&
    (!!adapter.download || (entries.length === 1 && entries[0].kind === "file" && !!adapter.content));

/**
 * Asks the adapter for a download's entries as one file to save: a single file from `content` when
 * it has one, and otherwise what `download` hands over. A blob that comes without a name, and
 * isn't a `File`, is named after the entry, or for several, after the folder they're in.
 */
export const prepareDownload = async (
    { adapter, entries, folderName, showHidden }: Pick<DownloadItem, "adapter" | "entries" | "folderName" | "showHidden">,
    { signal, onProgress }: { signal: AbortSignal; onProgress: (loaded: number, total: number) => void },
): Promise<PreparedDownload> => {
    const [only] = entries;

    if (entries.length === 1 && only.kind === "file" && adapter.content) {
        return {
            content: await adapter.content(only, { signal, purpose: "download", onProgress }),
            name: only.name,
        };
    }

    if (!adapter.download) {
        throw new Error("Not supported here.");
    }

    const handed = await adapter.download([...entries], { signal, showHidden, onProgress });

    if (handed.url !== undefined) {
        return { content: { url: handed.url }, name: handed.name ?? "" };
    }

    const ownName = handed.blob instanceof File ? handed.blob.name : "";
    const fallback = entries.length === 1 ? only.name : folderName;

    return { content: { blob: handed.blob }, name: handed.name || ownName || fallback };
};

/**
 * Whether the browser saves a URL under the name a link gives it, rather than as its server says:
 * one on the page's own origin, a blob URL or a data URL.
 */
const savesUnderName = (url: string) => {
    try {
        const { protocol, origin } = new URL(url, document.baseURI);

        return protocol === "blob:" || protocol === "data:" || origin === window.location.origin;
    } catch {
        return false;
    }
};

// A link with `download`, clicked in the page, as Firefox once needed, and gone again at once.
const clickLink = (url: string, name: string) => {
    const link = document.createElement("a");

    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
};

/**
 * Hands a prepared download to the browser to save. A blob, or a URL the browser saves under the
 * link's name, is saved at once. A URL on another origin is saved only as its server says, so it
 * opens in a new tab, which the browser closes as it sees a download, rather than in the page,
 * which a server answering with an error, or with no `Content-Disposition: attachment`, would
 * replace. Returns false when the browser blocked that tab, as it may once the click that asked for
 * the download is a few seconds old, so it has to be asked for again from a click.
 */
export const saveFile = ({ content, name }: PreparedDownload) => {
    if (content.url === undefined) {
        const url = URL.createObjectURL(content.blob);

        clickLink(url, name);
        setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER);

        return true;
    }

    if (savesUnderName(content.url)) {
        clickLink(content.url, name);

        return true;
    }

    const opened = window.open(content.url, "_blank");

    if (!opened) {
        return false;
    }

    // The tab has no business with the page that opened it.
    opened.opener = null;

    return true;
};
