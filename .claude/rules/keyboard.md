---
paths:
  - "src/components/file-manager/file-manager.tsx"
  - "src/components/file-manager/content/**"
  - "src/components/file-manager/sidebar/**"
  - "src/components/file-manager/header-bar/header-bar.tsx"
  - "src/components/file-manager/context-menu/**"
  - "src/components/file-manager/dialogs/transfer-dialog.tsx"
  - "src/utils/keyboard.ts"
  - "src/utils/shortcut.ts"
  - "src/hooks/use-type-ahead.ts"
---

# Keyboard and screen readers

Everything a pointer does in the content and the sidebar tree can be done from the keyboard, and both panes tell screen readers what they hold and what is selected. Plain key logic lives in `utils/keyboard.ts` (`stepIndex`, `matchName`, `isMenuKey`, the tree's `shownTreeItems`), and `hooks/use-type-ahead.ts` collects the letters typed in quick succession.

## Order of keys

A key press goes to the consumer's shortcuts before the component's own keys, so an action can take Enter or Space (`shortcut` in `types/action.ts`, `runShortcut` in `file-manager.tsx`). Keys the component takes:

| Where | Keys |
|---|---|
| Anywhere in the file manager (`file-manager.tsx`) | F6 between the sidebar tree and the content, F9 to show and hide the collapsed sidebar, Alt+Left and Alt+Right for back and forward |
| Content (`content/folder-view.tsx`) | arrows, Home, End, PageUp, PageDown, Space, Shift+Space, Enter, Alt+Down, Backspace, Alt+Up, Ctrl+A, Escape, typing, Menu or Shift+F10 |
| Sidebar tree (`sidebar/sidebar.tsx`, `TreeItem` in `sidebar/location-item.tsx`) | Up, Down, Home, End, Right, Left, Enter, Space, Shift+Space, typing, Menu or Shift+F10, Escape (closes the overlay) |
| "Move to…" and "Copy to…" (`dialogs/transfer-dialog.tsx`) | Up, Down, Home, End, PageUp, PageDown, typing, Enter or Space to open, Backspace or Alt+Up to go up |

- The root's handler ignores presses from the menus and dialogs, which portal out of it but still bubble through React's tree, by checking that the DOM holds the target.
- Browsers keep some keys. Chrome never passes Ctrl+N, Ctrl+T or Ctrl+W to a page, and F6, F9 or Alt+Left may be taken by the browser before the page sees them.
- Left and Right swap when the view or tree computes as `direction: rtl` (`isRtl`), ahead of RTL support.

## Content

The list and the grid are each a `listbox` (`aria-multiselectable`, named by the folder) with an `option` per entry carrying `aria-selected`. The column headers are a `group` named "Sort by", and the active one reads its direction ("Name, sorted A to Z") from visually hidden text (`visuallyHiddenSx`).

- Roving focus: only the focused entry (`focusId` in `FileViewProps`) has `tabIndex={0}`. `FolderView` keeps it with where it was listed, so when it's removed (deleted, moved away) the entry now at that place takes over. Without one, the first selected entry, or the first, has the Tab stop.
- Plain arrows select the entry moved to, as a click does; Shift extends from the anchor (from the entry focused until then when there's none yet, `select`'s `fallbackAnchor` in `use-selection.ts`); Ctrl or ⌘ moves without selecting, and Space then toggles. Selection mode moves without selecting too. In the grid, Up and Down move by the columns `getComputedStyle` reports, and Down from the row above a shorter last row lands on the last entry. PageUp and PageDown move by what fits in the panel.
- Enter and Alt+Down open the focused folder; files have no built-in action, so a consumer binds Enter to theirs. Backspace and Alt+Up go to the folder above.
- Typing goes to the next entry whose name starts with the letters typed within 500 ms, case and accents aside (`matchName`); one letter repeated steps through the names starting with it, and a space mid-query is part of it.
- Escape leaves selection mode or clears the selection, and Ctrl+A selects all, from anywhere in the view. The other keys only apply on an entry or the view itself, so a column header or "Try again" keeps Enter and Space.
- Menu or Shift+F10 opens the focused entry's menu below its ⋮ button (or below the tile), or the folder's menu at the panel's top corner. The ⋮ buttons are `aria-hidden` and out of the tab order, since that key reaches the same menu.
- A folder that lists nothing (loading, empty, error) is tabbed to itself: the surface becomes a `group` named by the folder and described by its state, rings the panel when focused from the keyboard, and keeps the shortcuts working. The error state is an `alert`, and spinners are labelled "Loading".
- A visually hidden `status` says how many entries are selected as that changes.

### Focus across folders

The folder view is remounted per folder, so the focused element goes with it. `file-manager.tsx` sets `focusContent` for one render (`takeFocus` on `FolderView`, cleared in an effect after the children's run), and the new view takes the focus as soon as it has something to focus, holding it on itself while the folder loads.

- `arrive` sets it when the focus was in the content panel, or in the context menu opened from it (`menuOpener`), so an "Open" action picked there counts.
- Navigating from the overlay sidebar sets it too, since the overlay closes.
- Going up to a folder the open one is in, by any route (Backspace, the path bar, back), reveals the folder left through (`folderLeft` in `utils/navigation.ts`): it's selected, scrolled to and, when the view has or takes the focus, focused, as in GNOME Files.
- Removing the focused entry drops the focus to the page without a blur, and React never sees a blur from a removed node, so `focusWithin` stays set and the entry taking its place gets the focus back. A blur that really leaves the view clears it. A created or renamed entry that's revealed takes the focus the same way, after the dialog has given it back.

## Sidebar tree

The sidebar's `nav` holds one `tree` (`aria-multiselectable`). Each section group is a `group` named by its title (the visible caption and the divider are `aria-hidden`), a single section's tree sits in a `ul` with `role="none"`, and each folder's children are a `group`. Every section and folder is a `treeitem` `li` with `aria-level`, `aria-expanded` when it can expand, `aria-selected`, `aria-current="page"` for the open folder, `aria-busy` while loading and `aria-label`, since its content includes the rows below it.

- The tree is one tab stop. Its container is tabbable while no row has the focus and hands it to the last focused row, else the open folder's, else the first (`handleTreeFocus`); while a row has it, the container leaves the tab order so Shift+Tab gets out. Rows have `tabIndex={-1}`, and a press on a row focuses its `li`.
- The rows' main part and chevron are no longer buttons, the chevron is `aria-hidden`, and the ring is drawn on the row (`[role="treeitem"]:focus-visible > &`) since the `li` wraps its children.
- Rows handle what acts on them, guarded so a key doesn't act on every row it bubbles through: Enter opens, Space toggles a folder in the tree's selection and Shift+Space selects a range (on a section, Space opens), Right expands, Left collapses, Menu or Shift+F10 opens its menu, and consumer shortcuts run with the folder (or the tree's selection, if it's in it) as entries and the folder itself as the "folder" target, so Ctrl+V pastes into it and F5 lists it again. A section row's shortcuts run in its root. The tree then moves the focus: Up, Down, Home, End over the rows shown (`shownTreeItems`), Right into an expanded row, Left to the row above, and typing by `aria-label`.
- Moving the focus never opens or selects, as in the content with Ctrl held.
- A row that unmounts while focused hands the focus to the row shown before it (`useFocusHandOff`, a layout effect cleanup, which runs while the row is still in the page).
- A folder that couldn't be listed shows a `treeitem` "Couldn't load. Retry", which Enter, Space or its link retries.

### The overlay

Below `rootWide` the sidebar is collapsed, and two keys open it besides the "Show sidebar" button: F9 shows and hides it, as in GNOME Files, and F6 opens it from anywhere outside it. It takes the focus as it opens.

- `openSidebar` keeps what had the focus (`sidebarOpener`), and `closeSidebar` gives the focus back to it, or to the "Show sidebar" button when it's gone, if the focus was in the overlay. Escape and F9 close it so.
- Focus moving on to the rest of the file manager, by Tab or F6 for instance, closes it as a click behind it does, and leaves the focus where it went. Focus going to a menu or dialog, outside the file manager, keeps it open.
- Docked, F9 does nothing and is left to the browser, since a docked sidebar can't be hidden yet, and closing never moves the focus.
- `overlays()` in `file-manager.tsx` tells the two modes apart from the sidebar's computed `position`, as container queries decide it.

## Move and copy dialog

The transfer picker's folder list (`dialogs/transfer-dialog.tsx`) is one tab stop, focused once the dialog has faded in (the transition's `onEntered`, since the closing context menu takes back focus given any sooner), so the path bar, the list and the buttons are three stops rather than one per folder.

- Rows are `ListItemButton`s in `ListItem`s with a roving `tabIndex`. The arrows, Home, End, PageUp and PageDown move between the rows that can be opened, skipping the entries themselves, and typing finds one by name (`stepIndex`, `matchName`), without spaces, since Space opens a row.
- Enter or Space opens the focused folder or section, as a click does, and Backspace or Alt+Up goes up as the Back button does (`canGoUp`).
- Opening a folder or going up from the list keeps the focus in it (`pendingFocus`, settled after each render from the row with `tabindex="0"`): on the first row, or going up, on the folder left through (`folderLeft`), or the section left when going back to the list of sections. While a folder loads, or when it has no folders, the box in the list's place holds the focus, still taking Backspace, and is a `group` named by the folder. The conflict step's Back gives the focus back to the list.
- Going up with the path bar or the Back button leaves the focus there, but the folder left through still gets the list's Tab stop.

## Context menu

MUI's `Menu` gives the arrows, Enter, Escape and type-ahead, and gives the focus back on closing. Items carry `aria-keyshortcuts` (`ariaShortcut`, with ⌘ as Meta alongside Control). A `contextmenu` event inside the open menu, which some browsers send on releasing the Menu key that just opened it, leaves it open.

## Not yet

A one-step keyboard drop onto a folder; moving and copying go through cut and paste or the transfer dialog. Hiding the docked sidebar, with F9 or otherwise.
