# Search

There are two searches, as in GNOME Files.

## The open folder's search

Ctrl+F, or the button beside the path bar, filters the open folder as the user types: the entries whose names hold every word typed, anywhere, in any order, case and accents aside. It needs nothing of the adapter; it filters the listing already there.

## Search everywhere

Ctrl+Shift+F, or the magnifier at the top of the sidebar, searches every section whose adapter has `search`:

```ts
search?(rootId: string, query: string, options: {
    signal: AbortSignal;
    cursor?: string;
    showHidden: boolean;
}): Promise<SearchResult>;

interface SearchResult {
    matches: SearchMatch[];
    nextCursor?: string;
}

interface SearchMatch {
    entry: FileEntry;
    trail: FolderRef[]; // the folders from the root searched down to the one holding the entry
    score?: number;     // higher is better, for a backend that ranks its matches
}
```

- It's called once per section, with the section's `rootId`, so two sections sharing an adapter are searched apart. `query` is what's typed, trimmed, a moment after the typing stops (300 ms, `limits.searchDelay`).
- **How entries match is your backend's call.** Every word anywhere in the name, as the folder search does, is a good default; full-text search in contents is fine too.
- **`trail`** is required: the folders from the root down to the entry's folder, not counting the root itself, empty for an entry right in the root. The file manager never parses ids, so the trail is how it shows where each result is, opens its folder, and acts on it there.
- **Paging** works as `list`'s does: return `nextCursor` for more, and results show as they arrive. To cap the results, stop handing a cursor back.
- **`showHidden`** says whether hidden files are showing, so the backend can leave out hidden entries and what's in hidden folders.
- **Reject with an `Error`** to show its message beside that section's results, with Try again.

```ts
async search(rootId, query, { signal, cursor, showHidden }) {
    const params = new URLSearchParams({ root: rootId, q: query, hidden: String(showHidden) });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`/api/search?${params}`, { signal });
    if (!response.ok) throw new Error("Couldn't search.");

    const body = await response.json();
    return {
        matches: body.matches.map((match: ApiMatch) => ({ entry: toEntry(match.entry), trail: match.trail })),
        nextCursor: body.nextCursor ?? undefined,
    };
}
```

The results show in the content, with a tab per section when there are several, and work as a folder does: select, open, drag, preview, and act on them through the context menu. Their Location column says where each is. They start ordered by relevance (by `score` when the backend gives it, otherwise by how well the name answers what's typed), and the column headers order them otherwise. After a change made through the file manager the search runs again, so a result renamed or deleted updates.

A selection from several folders gets only the actions marked `acrossFolders` (see [Actions](actions.md#a-searchs-results-from-several-folders)).

Sections without `search` aren't searched, and aren't crawled with `list` either, which would be a request per folder. The trash section is never searched. With no section that can be searched, there's no search everywhere.

The field's sections menu lets the user leave sections out; that's public state too (`searchExcludedSections`).

## From your own code

```ts
apiRef.current?.search("everywhere", "invoice");
apiRef.current?.search("folder");
apiRef.current?.closeSearch();
```

The search itself can be controlled, as `search` / `defaultSearch` / `onSearchChange`, a `{ scope, query }` or `null` while closed. See [State and the API](state-and-api.md).
