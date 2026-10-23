---
paths:
  - "src/index.ts"
  - "src/components/file-manager/file-manager.tsx"
  - "src/types/api.ts"
  - "src/types/navigation.ts"
  - "src/types/selection.ts"
  - "src/types/section.ts"
  - "src/hooks/use-setting.ts"
  - "src/hooks/use-stable-set.ts"
  - "src/hooks/use-location-history.ts"
  - "src/hooks/use-selection.ts"
  - "src/styles/sx.ts"
  - "playground/app.tsx"
  - "playground/options.ts"
  - "playground/hooks/**"
---

# Public props

Besides `adapter`, `sections` / `section` and `actions` (CLAUDE.md), `onOpenFile` (`preview.md`) and `localeText` / `locale` (`locale.md`), `FileManager` takes the props below. Their comments in `file-manager.tsx` are the consumer's documentation, so they say what each does from the outside.

## Controlled or not

Seven pieces of state can each be controlled, as MUI's are: pass the value and change it in its callback, or leave it to the file manager, starting from its `default…` prop.

| State | Controlled | Uncontrolled start | Told through | The user changes it with |
|---|---|---|---|---|
| Location | `location` | `defaultLocation`, else the first section's root | `onLocationChange(location, reason)` | the sidebar, the path bar, opening folders, back and forward |
| View | `view` | `defaultView`, "list" | `onViewChange` | the header's view button |
| Order | `sort` | `defaultSort`, name A to Z | `onSortChange` | the view menu, the list's column headers |
| Hidden files | `showHidden` | `defaultShowHidden`, false | `onShowHiddenChange` | Ctrl+H, the view menu |
| Docked sidebar hidden | `sidebarHidden` | `defaultSidebarHidden`, false | `onSidebarHiddenChange` | F9, the view menu, the header's "Show sidebar" |
| Tree folders expanded | `expandedFolders` | `defaultExpandedFolders`, else the section opened in | `onExpandedFoldersChange` | the chevrons, Right and Left on a row, a drag resting on a row |
| Content selection | `selectedIds` | `defaultSelectedIds`, none | `onSelectionChange(ids, { entries, location })` | clicks, keys, the marquee, touch selection mode |

- Which one is decided on mounting. MUI's `useControlled` warns in development about switching later, and about a `default…` changing after mounting. The view settings and the expanded folders go through `useSetting` (`hooks/use-setting.ts`), which is `useControlled` plus the callback, set to a value or with a function of the value as of the latest render; the location and the selection have hooks of their own, so `useControlled` is called for them for its warnings alone.
- The expanded folders are `SectionFolder`s (`types/section.ts`, public), a section id and a folder id, a section's row being its root folder. Inside they're `folderKey`s, turned back with `keyFolder`. A folder the tree doesn't show stays expanded, to show so again, and so does one of a section that's gone.
- The consumer's arrays of ids, `selectedIds` and `expandedFolders`, are turned into sets that stay the same while they hold the same ids (`useStableSet`), so a new array each render doesn't count as a change.
- Controlled, a change the user makes is only asked for: the callback is told, and nothing changes until the prop comes back with it. A change the consumer refuses never happens. The callbacks are called from the event handler that made the change, so a consumer's `setState` there renders together with the file manager's own.
- Setting a value to what it is tells nothing (`sameSort` compares orders by key and direction).
- The overlay sidebar's open state isn't a prop: it's a passing state of a narrow file manager, closed by most things done in it.

## Location

The location is a `FileManagerLocation` (`types/navigation.ts`, public): a section id and a trail of `FolderRef`s below its root, as `Place` was. `hooks/use-location-history.ts` holds it with the back and forward history.

- **Uncontrolled**, every change is made at once and told to `onLocationChange`. **Controlled**, a change is kept as `asked` and told, and made once the consumer passes its place back. The history stays the file manager's either way.
- A location the consumer passes of their own (`passedOn`) is the change asked for, once it's that change's place; back or forward, when it's where those lead, so the file manager's history keeps in step with a browser's whose buttons set it; a rename, when it's the same folders by other names; or else a new place, pushed.
- The reason (`LocationChangeReason`) says why: "navigate" (`navigate`, `goTo`), "back", "forward", or "replace" for `revise`, which rewrites places in the history (a rename, a delete, a section losing its root, a section removed, rooted elsewhere or served by another adapter). `revise` can drop places (null), and places that end up next to the same place become one, so back never leads to where the file manager is.
- A place in a section the file manager doesn't have, from a section removed or a location passed for one it never had (`defaultLocation` included), shows the first section's root at once, in the same render. A layout effect then revises the history: places in missing sections go, and the current one goes to that root, which a controlled location is asked for as "replace". It runs once per such location, so a consumer who keeps passing it isn't asked again and again.
- Going up to a folder the open one is in, however it's reached, the user's way or the consumer's, reveals the folder left through. That's worked out as the place changes, during rendering (`shownPlace`), not by the code that navigates, and a "replace" doesn't count. Taking the focus into the folder opened only happens for changes made inside the file manager (`leaveFor`, see `keyboard.md`).
- The trail is the consumer's to build when they pass one; it isn't checked against listings, since ids are never parsed. A folder that isn't there shows the open-folder error.
- Navigation never expands the sidebar tree, the consumer's included.
- The playground's `useHashLocation` keeps it in the URL's hash: "navigate", "back" and "forward" push an entry, "replace" replaces one, and `popstate` passes the location from the hash back, where the browser's back lands on the file manager's previous place or next place. A hash with no location, as the entry the page opened on may have, or one the playground doesn't know, is the first section's root, and is rewritten to it as the page opens and whenever the browser goes back to such an entry, so going back to the first entry leaves the folder it was in.

## Selection

The content's selection is the folder view's (`selection.md`), and is what `selectedIds`, `defaultSelectedIds` and `onSelectionChange` cover. The sidebar tree's selection is a passing one for acting on folders there, and isn't public.

- `file-manager.tsx` keeps the consumer's ids as a set (`selectedIdSet`, by `useStableSet`), so a new array of the same ids each render doesn't count as selecting them anew, and hands it to `FolderView` only when controlled.
- `useSelection` takes the ids when controlled and keeps only the anchor itself. Each change (`commit`) builds on the latest selection, kept in a ref, so changes made one after another in one event add up, and is reported as it's made, with the entries it selects.
- `FolderView` also reports the selection as it is in an effect, so a change of the listing under it (a selected entry deleted, hidden files turned off, a refreshed listing's new entry objects) and a folder opening are told too. `tellSelection` in `file-manager.tsx` tells `onSelectionChange` only what changed: the ids as a set, the entries by identity. `ids` is what to pass back; `entries` are the selected entries the content lists, in its order, which is what to act on, so a hidden selected entry is in `ids` but not `entries`.
- Every folder opens with nothing selected. Going somewhere from inside the file manager (`leaveFor`) asks a controlled selection to empty, told before the location, while a `location` changed by the consumer leaves the selection to them, so they can open a folder with an entry selected.
- `defaultSelectedIds` are for the folder the file manager opens in, while it stays open (`initialSelection`).
- A selection set from outside, `defaultSelectedIds` or `selectedIds` other than what the view last asked for (`requestedIds`), is revealed once the folder's listing is complete (`revealSelected`): the first of its entries the view lists takes the focus, if the view has it, or the Tab stop, and is scrolled to.
- Ids the folder doesn't list drop out once all of it has come (`retain`, by `listedIds`), not while it's coming, so a selection passed with a location isn't cut short. Hidden entries are listed, so they stay selected.
- Leaving touch selection mode clears the selection in an effect rather than while rendering, since a controlled one is changed through the consumer.

## The API

`apiRef` takes a `FileManagerApi` (`types/api.ts`, public), given with `useImperativeHandle`. It's the same object while the file manager is mounted, and its methods call what's current through a ref (`api`), so a consumer can keep it.

- `navigate(location)`, `back()` and `forward()` do what the user going there does (`goTo`, `goBack`, `goForward`), asked for when the location is controlled. A section the file manager doesn't have is ignored.
- `refresh(folderIds?, { adapter }?)` lists folders again, in every section or only those `adapter` serves: those with the ids and every listing holding one of them, as `relist` does, or every listing a section has cached without ids (`store.relist` with no ids). Folders not listed yet need nothing.
- `reveal(entryId, location?)` selects one entry alone and scrolls to it, through the same `Reveal` that selects a created or renamed entry, keyed by the folder it's meant for. With a location it navigates there, and the reveal waits for that folder to open: a reveal is only dropped when another folder opens. `FolderView` only gets `revealId` while its folder is the reveal's, and gives one up (`revealLost`) once its whole listing has come without the entry, or while it's hidden. One a folder search leaves out ends the search instead, and is revealed in the whole folder.
- `focus()` asks the content to take the focus, as F6 does (`focusContent`).
- `download(entries?, location?)` downloads entries as the context menu's `download` does, through the same queue and panel, or with none, the folder itself, and returns whether it asked for anything (see "From outside" in `download.md`).

## The root element

`FileManagerProps` takes the root `div`'s own attributes (`RootAttributes`), spread on it as a MUI component's root takes them, so `id`, `className`, `style`, `aria-*`, `data-*` and handlers go there. `title` is the sidebar's.

- The handlers the root uses itself, `onKeyDown`, `onDragEnter`, `onDragOver`, `onDrop`, `onDragEnd` and `onPointerDownCapture`, run the consumer's first, then the file manager's: a key press the consumer called `preventDefault` on is left alone (F6, F9, Ctrl+H, Alt+arrows), and so are files dragged in that they took, but a drag still ends.
- `ref` is forked with the file manager's own (`useForkRef`), and `sx` goes over the root's own styles (`withSx`, `styles/sx.ts`, shared with `Icon`). The root fills its container by default (100% wide and high), and lays itself out by its own width.

## Props changing after mounting

- A section removed takes its places out of the history, and the open one goes to the first section's root ("replace", above).
- A section rooted elsewhere, or served by another adapter (its own `adapter`, or the file manager's when it has none), goes back to its root, in the history too, since its trails lead nowhere now. Another adapter's ids mean something else, so its listings are dropped (`store.forgetSection`), and what shows them lists them again: `useFolder` by its `adapter` dependency, the sidebar tree because it remembers which adapter each shown folder was listed with (`useTreeRows`' `requested`). A rerooted section stays expanded or collapsed as it was. A clipboard of entries no section's adapter serves any more is dropped. These run in a layout effect over what each section had before (`servedBefore`).
- A `default…` prop changing does nothing, as with MUI's, which warn.
- `actions`, `title`, `onOpenFile`, the callbacks, `localeText` and `locale` take effect at once. A dialog open during a change finishes with the section and adapter it was opened for.

## The playground

By default the playground controls everything, as an app would: the location in the URL's hash (`hooks/use-hash-location.ts`), so a reload, a link or the browser's back button follows it, the four view settings and the expanded folders in local storage (`hooks/use-stored-state.ts`), and the selection in its own state, shown in a footer. The file manager shares the page with the footer through `sx`. The footer's "Show a file" calls `reveal` for a file far down `archive`'s 10,000 (in a single section, one in Website's `src/components`), "Reload all" calls `refresh()`, and "Download selection" ("Download folder" with nothing selected) calls `download`. `?uncontrolled` (`options.ts`) passes what it keeps as the `default…` props instead, so the file manager keeps everything itself, and only the footer's selection is told.
