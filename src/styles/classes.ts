/**
 * The class names an app can style the component's parts by, beside the hashed ones of their own
 * stylesheets, which change from build to build. They're public and kept from release to release,
 * so a name here is never changed or taken away without a major version, and a part keeps its name
 * however its insides are laid out. They carry no style of their own.
 *
 * Only what a user would point at is named: the roots, the regions, rows, tiles and their names and
 * icons, the dialogs and the kit's pieces, not the boxes that lay them out. A part's state is in its
 * attributes, not in a class: `.fm-list-row[data-selected="true"]`, `.fm-menu-item[data-highlighted]`
 * (see "Stable class names" in `component-styling.md`).
 *
 * One class is as strong as the part's own, so an app's rule wins as long as its stylesheet loads
 * after the component's, or with one more class or attribute in its selector.
 */
export const fmClasses = {
    // The roots, each also given the app's own `className`.
    /** `FileManager`'s root. */
    fileManager: "fm-file-manager",
    /** `MediaManager`'s root. */
    mediaManager: "fm-media-manager",
    /** `MediaPicker`'s root. */
    mediaPicker: "fm-media-picker",
    /** `MediaPicture`'s root. */
    mediaPicture: "fm-media-picture",

    // The kit, wherever it's used, in both components and what they portal out.
    /** A button with a label, with `data-variant` (`text`, `outlined`, `contained`) and `data-color`. */
    button: "fm-button",
    /** A round button holding an icon. */
    iconButton: "fm-icon-button",
    /** A built-in icon's `svg`. */
    icon: "fm-icon",
    /** A menu's popup. */
    menu: "fm-menu",
    /** A menu's item, `data-highlighted` while it's pointed at or focused, `data-disabled`. */
    menuItem: "fm-menu-item",
    /** A heading among a menu's items, such as "Sort by". */
    menuLabel: "fm-menu-label",
    /** A dialog's box, beside the dialog's own name (`nameDialog`, `preview`...). */
    dialog: "fm-dialog",
    dialogTitle: "fm-dialog-title",
    dialogContent: "fm-dialog-content",
    /** The row of buttons at a dialog's foot. */
    dialogActions: "fm-dialog-actions",
    /** The dim layer behind a dialog. */
    dialogBackdrop: "fm-dialog-backdrop",
    tooltip: "fm-tooltip",
    /** An outlined field with its label, `data-error` when it shows a problem. */
    textField: "fm-text-field",
    checkbox: "fm-checkbox",
    /** A pill, such as a tag. */
    chip: "fm-chip",
    /** A progress bar. */
    progress: "fm-progress",
    /** A spinner. */
    spinner: "fm-spinner",
    /** What shows in place of a view with nothing to show: empty, failed or no results. */
    state: "fm-state",

    // The file manager.
    sidebar: "fm-sidebar",
    /** The sidebar's top, with its title and buttons. */
    sidebarHeader: "fm-sidebar-header",
    /** The sidebar's tree of sections and folders. */
    tree: "fm-tree",
    /**
     * A section's or a folder's row in the tree, `data-kind` `section` or `folder`, with
     * `data-selected`, `data-open`, `data-cut`, `data-moving`, `data-dragged` and `data-drop-target`.
     */
    treeRow: "fm-tree-row",
    /** A section group's title in the tree. */
    treeGroupTitle: "fm-tree-group-title",
    /** The bar over the content, with back and forward, the path and the view's buttons. */
    header: "fm-header",
    pathBar: "fm-path-bar",
    /** A folder's segment of the path bar, the section's first. */
    pathSegment: "fm-path-segment",
    /** The search field, in the file manager's header and the media manager's. */
    searchField: "fm-search-field",
    /** The field a path is typed in, in the path bar's place. */
    pathField: "fm-path-field",
    /** The panel the folder or a search's results show in. */
    content: "fm-content",
    /** The list view. */
    list: "fm-list",
    /** The list's row of column headers. */
    listHeader: "fm-list-header",
    /**
     * An entry's row in the list, with `data-selected`, `data-striped`, `data-cut`, `data-moving`,
     * `data-arrived`, `data-found`, `data-dragged` and `data-drop-target`.
     */
    listRow: "fm-list-row",
    /** A cell of a list row or of the header, `data-column` `name`, `location`, `size`, `type` or `modified`. */
    listCell: "fm-list-cell",
    /** The grid view. */
    grid: "fm-grid",
    /** An entry's tile in the grid, with the list row's attributes but `data-striped`. */
    gridTile: "fm-grid-tile",
    /** An entry's icon or thumbnail, in the list, the grid and the drag image. */
    entryIcon: "fm-entry-icon",
    /** An entry's name, in the list and the grid. */
    entryName: "fm-entry-name",
    /** The tabs over a search everywhere's results. */
    searchTabs: "fm-search-tabs",
    /** One of them, `aria-selected` while it's open. */
    searchTab: "fm-search-tab",
    /** The bar over the trash, with its Empty button. */
    trashBar: "fm-trash-bar",
    /** The bar of the touch selection mode. */
    selectionBar: "fm-selection-bar",
    /** The notice over the content saying what was done, with Undo. */
    notice: "fm-notice",
    /** The box drawn while selecting by dragging. */
    marquee: "fm-marquee",
    /** The docked sidebar's and properties' edge, `data-dragging` while it's dragged. */
    resizeEdge: "fm-resize-edge",
    /** The image a drag of entries carries. */
    dragPreview: "fm-drag-preview",
    /** The upload, download and transfer panels under the content, beside their own names. */
    taskPanel: "fm-task-panel",
    uploadPanel: "fm-upload-panel",
    downloadPanel: "fm-download-panel",
    transferPanel: "fm-transfer-panel",
    /** One upload, download or transfer in its panel. */
    taskRow: "fm-task-row",
    /** The properties panel, docked, over the content, or in the media manager. */
    properties: "fm-properties",
    /** The properties panel's top, with its title and actions. */
    propertiesHeader: "fm-properties-header",
    /** A group of properties under its title. */
    propertiesGroup: "fm-properties-group",
    /** One property: its label and its value. */
    property: "fm-property",
    /** `PropertyDisplay`'s links or tags. */
    propertyDisplay: "fm-property-display",
    /** The preview's dialog. */
    preview: "fm-preview",
    /** The preview's top, with the name, the counter and the actions. */
    previewHeader: "fm-preview-header",
    nameDialog: "fm-name-dialog",
    /** "Move to…" and "Copy to…". */
    transferDialog: "fm-transfer-dialog",
    pasteDialog: "fm-paste-dialog",
    deleteDialog: "fm-delete-dialog",
    restoreDialog: "fm-restore-dialog",
    uploadDialog: "fm-upload-dialog",
    shortcutsDialog: "fm-shortcuts-dialog",

    // The media manager and the picker.
    /** The list of libraries. */
    mediaLibraries: "fm-media-libraries",
    /** A library in it, `aria-current` for the open one. */
    mediaLibrary: "fm-media-library",
    /** The bar over a library, with its name or search and its buttons. */
    mediaHeader: "fm-media-header",
    /** The trail of groups gone into. */
    mediaGroupPath: "fm-media-group-path",
    /** A library's assets and groups, as tiles or rows. */
    mediaGrid: "fm-media-grid",
    /**
     * An asset or group in the grid, around how it's drawn, `aria-selected` while chosen, `data-layout`
     * `tile` or `row`, `data-held` while it can't be chosen.
     */
    mediaOption: "fm-media-option",
    /** `MediaTile`, the component's drawing of an asset or group as a tile, `data-kind` its kind. */
    mediaTile: "fm-media-tile",
    /** `MediaRow`, as a row. */
    mediaRow: "fm-media-row",
    /** A file being uploaded, as a tile or a row. */
    mediaUpload: "fm-media-upload",
    /** The view of one asset. */
    mediaAsset: "fm-media-asset",
    /** The column of chosen assets. */
    mediaChosen: "fm-media-chosen",
    /** A chosen asset in it. */
    mediaChoice: "fm-media-choice",
    /** A step in the library's place: uploading, processing, a pick's form. */
    mediaStep: "fm-media-step",
    /** The fields of a form, `MediaFields`. */
    mediaFields: "fm-media-fields",
    /** One field among them. */
    mediaField: "fm-media-field",
    /** The bar to choose with, at the media manager's foot. */
    mediaChooseBar: "fm-media-choose-bar",
    /** The picker's foot. */
    mediaPickerFooter: "fm-media-picker-footer",
    /** What shows while files are dragged over a library. */
    mediaDropZone: "fm-media-drop-zone",
} as const;
