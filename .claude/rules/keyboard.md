---
paths:
  - "src/components/file-manager/file-manager.tsx"
  - "src/components/file-manager/announcer.tsx"
  - "src/hooks/use-announcer.ts"
  - "src/components/file-manager/content/**"
  - "src/components/file-manager/sidebar/**"
  - "src/components/file-manager/header-bar/header-bar.tsx"
  - "src/components/file-manager/header-bar/search-field.tsx"
  - "src/components/file-manager/header-bar/search-sections-menu.tsx"
  - "src/components/file-manager/context-menu/**"
  - "src/components/file-manager/dialogs/transfer-dialog.tsx"
  - "src/components/file-manager/dialogs/shortcuts-dialog.tsx"
  - "src/components/file-manager/properties-pane.tsx"
  - "src/components/properties/**"
  - "src/utils/keyboard.ts"
  - "src/utils/shortcut.ts"
  - "src/hooks/use-type-ahead.ts"
---

# Keyboard and screen readers

Everything a pointer does in the content and the sidebar tree can be done from the keyboard, and both panes tell screen readers what they hold and what is selected. Plain key logic lives in `utils/keyboard.ts` (`stepIndex`, `matchName`, `isMenuKey`, `focusTreeItem`), and `hooks/use-type-ahead.ts` collects the letters typed in quick succession.

## Order of keys

A key press goes to the consumer's shortcuts before the component's own keys, so an action can take Enter or Space (`shortcut` in `types/action.ts`, `runShortcut` in `file-manager.tsx`). Keys the component takes:

| Where | Keys |
|---|---|
| Anywhere in the file manager (`file-manager.tsx`) | the main menu items' shortcuts first (see "The main menu" in `file-manager.md`), then F6 between the sidebar tree, the content and the docked properties, F9 to show and hide the sidebar, Ctrl+? for the keyboard shortcuts (Ctrl only, not ⌘), Ctrl+H to show and hide hidden files (Ctrl only, not ⌘), Ctrl+F or ⌘F to search the open folder and Ctrl+Shift+F or ⌘⇧F every section, Alt+Enter to show and hide the properties, Alt+Left and Alt+Right for back and forward (swapped right to left) |
| Content (`content/folder-view.tsx`) | arrows, Home, End, PageUp, PageDown, Space, Shift+Space, Enter, Alt+Down, Backspace, Alt+Up, Ctrl+A, Escape, typing, Menu or Shift+F10, Ctrl+V or Shift+Insert for files pasted from the desktop |
| Sidebar tree (`sidebar/sidebar.tsx`, `TreeItem` in `sidebar/location-item.tsx`) | Up, Down, Home, End, Right, Left, Enter, Space, Shift+Space, typing, Menu or Shift+F10, Ctrl+V or Shift+Insert for files pasted from the desktop, Escape (closes the overlay) |
| The properties (`properties-pane.tsx`) | Escape back to the content from the docked panel, or to close the overlay (see "The properties" below), then the shortcuts of the app's actions in its header (`propertiesActions`) |
| The search field (`header-bar/search-field.tsx`) | Escape to close, Down or Enter on to the content, Alt+Down for the sections menu (see "Search" in `file-manager.md`) |
| A search everywhere's results (`content/search-results.tsx`) | the content's keys but Backspace and Alt+Up, which lead nowhere; on its tabs (`content/search-tabs.tsx`), Left, Right, Home and End (see "Search results" below) |
| "Move to…" and "Copy to…" (`dialogs/transfer-dialog.tsx`) | Up, Down, Home, End, PageUp, PageDown, typing, Enter or Space to open, Backspace or Alt+Up to go up |
| The preview (`dialogs/preview-dialog.tsx`) | Left and Right to step through the files, Home and End to the first and last, F for full screen, Space or Escape to close (Escape leaving full screen first), +, -, 0 and 1 to zoom an image, R and Shift+R to turn it (`dialogs/image-viewer.tsx`) and the arrows to pan it zoomed in, then the shortcuts of the app's actions in its header (`previewActions`) (see `preview.md`) |
| The keyboard shortcuts (`dialogs/shortcuts-dialog.tsx`) | Escape or Ctrl+? to close, and the arrows, PageUp and PageDown to scroll |

Every key in this table that a user would look for is listed in the keyboard shortcuts window (see "The keyboard shortcuts window"), so **a key added or changed here is added or changed there too**.

- "Anywhere" means wherever the focus is inside the root, since key presses start from the focused element. The root and the sidebar are `tabIndex={-1}` with no outline, so a press on empty space that holds nothing focusable (the header's, the sidebar's below its rows) focuses the nearest of them rather than dropping the focus to the page, out of the root's reach. In the sidebar, F6 then goes on to the content, and the overlay stays open, as the focus hasn't left it. A consumer's own `tabIndex` on the root replaces it.
- The root's handler ignores presses from the menus and dialogs, which portal out of it but still bubble through React's tree, by checking that the DOM holds the target.
- Browsers keep some keys. Chrome never passes Ctrl+N, Ctrl+T or Ctrl+W to a page, and F6, F9 or Alt+Left may be taken by the browser before the page sees them. Ctrl+H, the browser's history elsewhere, and Ctrl+F or ⌘F and Ctrl+Shift+F, its find, reach the page and are kept from the browser while the focus is in the file manager. ⌘? opens the browser's Help menu on macOS, so the shortcuts are Ctrl+? there too, as hidden files are Ctrl+H.
- A main menu item's shortcut runs before the file manager's own keys, as the actions' do in the content and the tree, but not for a key that types into the search field (no Ctrl, ⌘ or Alt, and not an F-key: `typesInField` in `utils/shortcut.ts`).
- A consumer action bound to one of these keys runs instead in the content and the tree, where shortcuts run, since they come first and the root's handler skips a press already handled.
- A shortcut matching a disabled action still takes the key, so the browser does nothing with it, except the paste key (Ctrl+V, ⌘V, Shift+Insert: `pastes` in `utils/shortcut.ts`), which goes on to the browser, whose `paste` may carry files from the desktop to upload (see "Starting an upload" in `uploads.md`).
- Letters and digits are matched on any keyboard layout (see "Keyboard layouts").
- Left and Right swap when the view or tree computes as `direction: rtl` (`isRtl` in `utils/dom.ts`), and Alt+Left and Alt+Right swap when the file manager does (`useTextDirection`), as the back and forward arrows are mirrored (see `rtl.md`).

## Keyboard layouts

A shortcut's letter or digit is the key printed with it, whatever layout is on, as desktop toolkits and browsers do it. Neither of the event's two names for a key does that alone: `key` is what the layout types, which on Russian, Arabic, Hebrew or Greek is no Latin letter at all, and `code` is the key's place on a US keyboard, which on AZERTY puts Ctrl+A on the key marked Q, and on QWERTZ Ctrl+Z on the one marked Y. So `pressedKeys` (`utils/shortcut.ts`) gives a press as both, the likeliest first:

- The key the layout types, lowercased, when it's a Latin letter or digit, or a named key (F2, Delete, the arrows, Space), which is the same on every layout. So Ctrl+Z is the key marked Z on QWERTY, AZERTY, QWERTZ and Dvorak alike.
- Otherwise that, then the Latin letter or digit at the key's place, from `code` ("KeyH", "Digit1"), since non-Latin keyboards print the US letters beside their own. It also covers what Shift, AltGr or Option make of a key: AZERTY's digit row types "&", "é" and so on without Shift, and Option+H types "˙" on macOS.

Everything that binds a letter, a digit or a symbol goes through it: the consumer's shortcuts (`matchesShortcut`, tried with each key the press stands for in turn, across the selection and the folder, so the key typed wins over the one at its place), the main menu items' shortcuts likewise, Ctrl+A, Ctrl+H, Ctrl+F and Ctrl+Shift+F, Ctrl+?, and the preview's zoom keys. Symbols such as + and - are matched only as typed, wherever the layout has them. Ctrl+? is "?" as typed, with or without Shift, wherever the layout has it, or the Arabic and Persian "؟", which theirs type in its place (`showsShortcuts`). Type-ahead goes by the character typed, as it should.

Limits: a non-Latin layout on a keyboard whose Latin letters aren't laid out as on a US one (a Russian layout on a French keyboard) gets the US place; so does Option+letter on a non-QWERTY macOS layout. Reading the layout itself (`navigator.keyboard.getLayoutMap()`) would fix both, but only Chromium has it.

## Content

The list and the grid are each a `listbox` (`aria-multiselectable`, named by the folder) with an `option` per entry carrying `aria-selected`, and `aria-setsize` and `aria-posinset`, since only the entries in or near view are rendered (see `virtualization.md`). The column headers are a `group` named "Sort by", and the active one reads its direction ("Name, sorted A to Z") from visually hidden text (`visuallyHiddenSx`).

- Roving focus: only the focused entry (`focusId` in `FileViewProps`) has `tabIndex={0}`, and it stays rendered however far the panel scrolls. Moving the focus to an entry that isn't rendered yet focuses it and scrolls to it a render later (`pendingScroll`). `FolderView` keeps it with where it was listed, so when it's removed (deleted, moved away) the entry now at that place takes over. Without one, the first selected entry, or the first, has the Tab stop.
- Plain arrows select the entry moved to, as a click does; Shift extends from the anchor (from the entry focused until then when there's none yet, `select`'s `fallbackAnchor` in `use-selection.ts`); Ctrl or ⌘ moves without selecting, and Space then toggles. Selection mode moves without selecting too. In the grid, Up and Down move by its columns (`lines.columns`, read from its tracks), and Down from the row above a shorter last row lands on the last entry. PageUp and PageDown move by what fits in the panel.
- Enter and Alt+Down open the focused entry: a folder here, a file with `onOpenFile` or else in the preview (see `preview.md`). A file nothing can open leaves the key to the consumer's actions. Backspace and Alt+Up go to the folder above.
- Typing goes to the next entry whose name starts with the letters typed within 500 ms, case and accents aside, as the `locale` prop's language counts them (`matchName` with `Locale.sameLetters`); one letter repeated steps through the names starting with it, and a space mid-query is part of it, so it never runs a shortcut bound to Space, such as the playground's Preview.
- Escape leaves selection mode or clears the selection, and Ctrl+A selects all, from anywhere in the view. The other keys only apply on an entry or the view itself, so a column header or "Try again" keeps Enter and Space.
- Menu or Shift+F10 opens the focused entry's menu below its ⋮ button (or below the tile), or the folder's menu at the panel's top corner. The ⋮ buttons are `aria-hidden` and out of the tab order, since that key reaches the same menu.
- A folder that lists nothing (loading, empty, error) is tabbed to itself: the surface becomes a `group` named by the folder and described by its state, rings the panel when focused from the keyboard, and keeps the shortcuts working. The error state is an `alert`, and spinners are labelled "Loading".
- A visually hidden `status` says how many entries are selected as that changes.

### Search results

A search everywhere's results (see "Searching everywhere" in `file-manager.md`) are a `listbox` as a folder's are, named by the open tab's section or "Search results", with the same roving focus, keys, type-ahead and `status` regions, and the count of results heard once they've come. The focus handling is a copy of the folder view's, without the parts tied to a folder (going up, reveals, a controlled selection).

- The menu key opens the focused result's menu, for the selection when it's in one folder; there's no folder menu. Shortcuts run only for such a selection.
- `takeFocus` goes to the results while they show, and not to the folder view hidden under them, so Down or Enter in the search field goes on to them.
- The tabs are one tab stop, the open tab's (roving `tabIndex`). Left and Right move to the next or previous tab and open it, swapped when the strip computes as right to left, and Home and End go to the first and last, as a `tablist` with automatic activation does. Each tab is named by its section, then its count ("12 results") or that it couldn't be searched, from visually hidden text, the visible count `aria-hidden`, and the view below is the open tab's `tabpanel`.

### Focus across folders

The folder view is remounted per folder, so the focused element goes with it. `file-manager.tsx` sets `focusContent` for one render (`takeFocus` on `FolderView`, cleared in an effect after the children's run), and the new view takes the focus as soon as it has something to focus, holding it on itself while the folder loads.

- `leaveFor` sets it, as the file manager goes somewhere itself (the user, or `FileManagerApi.navigate`, `back` and `forward`), when the focus was in the content panel, or in the context menu opened from it (`menuOpener`), so an "Open" action picked there counts. A `location` the consumer changes doesn't move the focus.
- Navigating from the overlay sidebar sets it too, since the overlay closes.
- `FileManagerApi.focus()` sets it, for a consumer moving the focus into the file manager.
- Going up to a folder the open one is in, by any route (Backspace, the path bar, back, a `location` the consumer passes), reveals the folder left through (`folderLeft` in `utils/navigation.ts`), worked out as the place changes while rendering (`shownPlace`): it's selected, scrolled to and, when the view has or takes the focus, focused, as in GNOME Files.
- Removing the focused entry drops the focus to the page without a blur, and React never sees a blur from a removed node, so `focusWithin` stays set and the entry taking its place gets the focus back. A blur that really leaves the view clears it. A created or renamed entry that's revealed takes the focus the same way, after the dialog has given it back.

## Sidebar tree

The sidebar's `nav` holds one `tree` (`aria-multiselectable`). The tree is flat, since only the rows in or near view are rendered (see `virtualization.md`): each section group is a `group` named by its title (the visible caption and the divider are `aria-hidden`), holding its sections and the folders below them alike, and a single section's folders sit in a `ul` with `role="none"`. Every section and folder is a `treeitem` `li` that says where it is with `aria-level`, `aria-setsize` and `aria-posinset`, with `aria-expanded` when it can expand, `aria-selected`, `aria-current="page"` for the open folder, `aria-busy` while loading and `aria-label`.

- The tree is one tab stop. Its container is tabbable while no row has the focus and hands it to the last focused row (`focusKey`), else the open folder's, else the first (`handleTreeFocus`); while a row has it, the container leaves the tab order so Shift+Tab gets out. Rows have `tabIndex={-1}`, and a press on a row focuses its `li`.
- The focused row stays rendered however far the tree scrolls. A row the focus moves to that isn't rendered yet is rendered first (`focusRequest`), then focused and scrolled to (`focusRow`).
- The rows' main part and chevron are no longer buttons, the chevron is `aria-hidden`, and the ring is drawn on the row inside the `li` (`[role="treeitem"]:focus-visible > &`).
- Rows handle what acts on them, guarded so a key doesn't act on every row it bubbles through: Enter opens, Space toggles a folder in the tree's selection and Shift+Space selects a range (on a section, Space opens), Right expands, Left collapses, Menu or Shift+F10 opens its menu, and consumer shortcuts run with the folder (or the tree's selection, if it's in it) as entries and the folder itself as the "folder" target, so Ctrl+V pastes into it and F5 lists it again. A section row's shortcuts run in its root. The tree then moves the focus, going by the flat rows (`useTreeRows`) rather than the page: Up, Down, Home, End over the rows shown, Right into an expanded row (to the row after it, when that's deeper), Left to the row above (the nearest row before it that's shallower), and typing by the rows' labels.
- Moving the focus never opens or selects, as in the content with Ctrl held.
- A row that goes while focused, as a folder deleted or moved away does, hands the focus to the row shown before it, found among the rows of the render before (`previousRows`), since the focus has dropped to the page by then.
- A folder that couldn't be listed shows a `treeitem` "Couldn't load. Retry", which Enter, Space or its link retries.

### The overlay and the hidden sidebar

Below `rootWide` the sidebar is collapsed, and two keys open it besides the "Show sidebar" button: F9 shows and hides it, as in GNOME Files, and F6 opens it from anywhere outside it. It takes the focus as it opens.

- `openSidebar` keeps what had the focus (`sidebarOpener`), and `closeSidebar` gives the focus back to it, or to the "Show sidebar" button when it's gone, if the focus was in the overlay. Escape and F9 close it so.
- Focus moving on to the rest of the file manager, by Tab or F6 for instance, closes it as a click behind it does, and leaves the focus where it went. Focus going to a menu or dialog, outside the file manager, keeps it open.
- Docking, as the file manager widens, closes it too, so it doesn't show again as the width shrinks back. The sidebar that goes as the width changes, the overlay docking while the docked sidebar is hidden, or the docked sidebar collapsing, hands the focus it had to the content, as the properties do.
- Docked, F9 hides and shows the sidebar (`showDocked`; see "Hiding the docked sidebar" in `file-manager.md`). Hidden with the focus in it, it hands the focus to the content. Shown from the "Show sidebar" button, which only shows while the sidebar is hidden and so goes, the tree takes the focus; shown with F9 from anywhere else, the focus stays where it is. F6 passes a hidden sidebar by, to the content.
- `overlays()` in `file-manager.tsx` tells the two modes apart from the sidebar's computed `position`, as container queries decide it, even while the docked sidebar is hidden.

### The properties

The properties panel (see `properties.md`) is a third pane, docked on the content's other side from `rootExtraWide`, and an overlay below it, handled as the sidebar is.

- Alt+Enter shows and hides it from anywhere in the file manager. Enter is a named key, the same on every layout, and Alt with it is left alone by the content, the search results, the tree and the search field, so it reaches the root. Docked, the focus stays where it is, so the arrow keys keep moving through the content as the panel follows the selection, and the change is announced; hidden with the focus in it, it hands the focus to the content. Collapsed, the overlay takes the focus as it opens and gives it back to what had it as it closes.
- F6 goes from the content to the docked panel while it shows, and from the panel on to the sidebar tree (or the content, while the sidebar is hidden), so the panes go round sidebar, content, properties. From the overlay, F6 goes on as from anywhere else, which closes it.
- `ActionContext.properties()` moves the focus into the panel (`focusProperties`), after the context menu has given it back to where it opened, since React runs the menu's `FocusTrap` cleanup before the panel's effect in the same commit.
- Escape in the docked panel goes back to the content; in the overlay it closes it. The overlay closes too as the focus moves on to the rest of the file manager, as the sidebar's does, and as the pane docks, so it doesn't show again as the width shrinks back. The panel that goes as the width changes, the overlay docking while the docked panel is hidden, or the docked panel collapsing, hands the focus it had to the content.
- The panel is an `aside` named "Properties", focused as a whole (`tabIndex={-1}`) and ringed on `:focus-visible`; its rows are `dl`s, the backend's groups under `h3` titles, and its spinners are labelled ("Counting", "Loading").

## Move and copy dialog

The transfer picker's folder list (`dialogs/transfer-dialog.tsx`) is one tab stop, focused once the dialog has faded in (the transition's `onEntered`, since the closing context menu takes back focus given any sooner), so the path bar, the list and the buttons are three stops rather than one per folder.

- Rows are `ListItemButton`s in `ListItem`s with a roving `tabIndex`. The arrows, Home, End, PageUp and PageDown move between the rows that can be opened, skipping the entries themselves, and typing finds one by name (`stepIndex`, `matchName`), without spaces, since Space opens a row.
- Only the rows in or near view are rendered (see `virtualization.md`), and the row with the Tab stop. A key moving to a row that isn't rendered gives it the Tab stop, which renders it, and `pendingFocus` focuses it a render later. `settleFocus` waits for the rows to be in their places (`settled()`), then focuses the row and scrolls to it, so going up to a folder far down the list lands on it. Each `ListItem` carries `aria-setsize` and `aria-posinset`.
- Enter or Space opens the focused folder or section, as a click does, and Backspace or Alt+Up goes up as the Back button does (`canGoUp`).
- Opening a folder or going up from the list keeps the focus in it (`pendingFocus`, settled after each render from the row with `tabindex="0"`): on the first row, or going up, on the folder left through (`folderLeft`), or the section left when going back to the list of sections. While a folder loads, or when it has no folders, the box in the list's place holds the focus, still taking Backspace, and is a `group` named by the folder. The conflict step's Back gives the focus back to the list.
- Going up with the path bar or the Back button leaves the focus there, but the folder left through still gets the list's Tab stop and is scrolled to (`pendingScroll`, which `settleFocus` settles without focusing).
- A folder made with the toolbar's New folder button is opened, and the list takes the focus (`pendingFocus`) from the button the name dialog gave it back to, so Backspace goes straight back up to it.

## The keyboard shortcuts window

`dialogs/shortcuts-dialog.tsx` lists the keys, as GNOME's shortcuts window does. Ctrl+?, the main menu's "Keyboard shortcuts" and `FileManagerApi.showShortcuts()` open it (`showShortcuts` in `file-manager.tsx`). It's a modal like the other dialogs (portalled, `dialogPaperSx`), `md` wide, its sections in as many columns as fit (CSS `columns`, each section kept whole), each a heading over a `dl` on `background.paper`: what a key does, then its keys as `<kbd>` caps, `+` between keys pressed together and `/` between alternatives.

- The sections are General (with Alt+Enter for the properties), Navigation, Selection, Sidebar, Search and Preview (`ownSections`, the Preview with stepping, Home and End, the zoom keys, panning, turning, full screen and closing), then Actions: the consumer's actions, those of the preview's and the properties' headers too (`previewActions`, `propertiesActions`), and main menu items that have a `shortcut`, each label and key once, in their order (`consumerRows`).
- Search everywhere's key shows only when a section can be searched (`canSearchEverywhere`), Alt+Down only when the field has its sections menu (more than one), the Preview section only when a section's adapter has `content` or there are `previewers`, and General's "Upload files from the clipboard" (Ctrl+V, Shift+Insert) only when a section takes uploads (`canUpload`).
- A key the consumer's shortcuts bind does what theirs does in the content and the tree, so it's left out of the sections where they come first (`yields`: General, Navigation, Selection, Sidebar), compared by `comboId` (`utils/shortcut.ts`); a row left with no key goes. Only the context menu's actions and the main menu's items count for that, since the preview's and the properties' header actions run there alone, after their own keys. The playground's Preview takes Space, so "Select or deselect" shows only Ctrl+Space there. The search field and the preview aren't affected, since the content's shortcuts don't run there.
- Key names come from the text (`keyCtrl`, `keyEnter`... through `keyLabel`), the arrows show as arrows, and four arrows in one cap stand for any of them (read as `keyArrows`). Back and forward, and expand and collapse, swap right to left, as the keys do. The keys' cell is `dir="auto"`, so Latin key names run left to right on a right-to-left page, as "Ctrl+F" is written there.
- The list takes the focus once the dialog has faded in (`onEntered`), so the arrows and PageDown scroll it. Escape, its ✕ or Ctrl+? again closes it. It gives the focus back itself (`disableRestoreFocus`, then `handleShortcutsClosed` once it has faded out): to the element `showShortcuts` was given, the main menu's button when opened from it, since that menu only hands the focus back to its button as it closes, after the dialog has noted what had it, or else to what had the focus when it opened, or to the content when that's gone.

## Announcements

An action that finishes with nothing spoken about it is read out politely from one live region, `announcer.tsx` (a visually hidden `status` in the root), through `announce` from `useAnnouncer` (`hooks/use-announcer.ts`), called in `file-manager.tsx` as each operation ends. The checklist for a new feature in `props.md` asks whether it needs one.

- Announced, from the text's keys: a delete (`deleteDone`); a copy or move, by a paste, a drop or the picker (`copyDone`, `moveDone`), counting only the entries not skipped for names the folder had (the dialogs' `onDone` hands the skipped names over), and saying nothing when every one was; cutting or copying to the clipboard (`clipboardCut`, `clipboardCopied`); and creating a folder or renaming (`createDone`, `renameDone`). Names are isolated (`isolate`).
- Not announced, as something else says it: opening a folder (the focus and the view), a folder made in the transfer picker (the picker opens it, with the focus in its list), and a created or renamed entry that takes the focus as it's revealed. So a `Reveal` carries its message, and `FolderView`'s `onRevealed(focused)` says whether the entry took the focus; one that didn't, one given up on (hidden, or not listed) and one the open folder stops waiting for as another opens are announced. Made or renamed outside the open folder, it's announced at once.
- Showing and hiding the docked properties with Alt+Enter, which leaves the focus where it is, is announced (`propertiesShown`, `propertiesHidden`), unless the focus was in them. A value copied in the properties is said from the panel's own live region (`propertiesCopied`).
- Uploads and downloads aren't announced here: their panels have live titles of their own (see `uploads.md` and `download.md`), all but "Show in folder" on an upload (`uploadShown`), which opens a folder while the focus stays in the panel. A failure isn't either, since its dialog stays open to show it.
- A modal dialog hides the rest of the page from screen readers (MUI's `aria-hidden` on `<body>`'s other children) until it has faded out, and a live region in a hidden part goes unheard. So a message waits, watching `aria-hidden` with a `MutationObserver`, until the region has no hidden ancestor.
- While the preview is open, which stays open as its header's actions run (a cut, a copy, a delete or a rename made from there), messages are said from an `Announcer` inside it instead: each `Announcement` names its `region`, read as it's announced (`useAnnouncer`'s `regionOf`, "preview" while the preview is open), and each region's `Announcer` only takes its own. A dialog opened over the preview hides it in turn, so a message waits for that one to go.
- Each message goes in a node of its own, keyed by a count, so the same message twice is heard twice, and it's cleared after 7 s so browse mode doesn't come across old ones. A message announced before the last one was said replaces it.

## Context menu

MUI's `Menu` gives the arrows, Enter, Escape and type-ahead, and gives the focus back on closing. Items carry `aria-keyshortcuts` (`ariaShortcut`, with ⌘ as Meta alongside Control). A `contextmenu` event inside the open menu, which some browsers send on releasing the Menu key that just opened it, leaves it open.

## Moving and copying

There's no keyboard drag and drop, by choice. Cut or copy, then paste, does what a drop does: Ctrl+V on a tree row pastes into that folder, and in the content "Paste into folder" from a folder's menu (Menu key), across panes with F6. "Move to…" and "Copy to…" pick a folder from a list.
