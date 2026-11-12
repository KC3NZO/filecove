import type { ComponentType, ReactElement, SVGProps } from "react";

/**
 * A component drawing one icon as an `svg`. It's given a `className` that sizes it, colours it as
 * the text around it and mirrors it right to left where the icon points the way the text runs, so
 * it has to put that on its `svg`, with the other props it's handed.
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type IconName =
    | "add"
    | "arrowBack"
    | "arrowDown"
    | "arrowForward"
    | "arrowUp"
    | "check"
    | "chevronLeft"
    | "chevronRight"
    | "close"
    | "copy"
    | "cut"
    | "delete"
    | "deleteForever"
    | "desktop"
    | "documents"
    | "download"
    | "drive"
    | "edit"
    | "expand"
    | "file"
    | "filter"
    | "folder"
    | "folderOpen"
    | "fullScreen"
    | "fullScreenExit"
    | "gridView"
    | "home"
    | "info"
    | "listView"
    | "lock"
    | "menu"
    | "more"
    | "move"
    | "music"
    | "network"
    | "newFolder"
    | "paste"
    | "pictures"
    | "preview"
    | "recent"
    | "refresh"
    | "rename"
    | "restore"
    | "rotateLeft"
    | "rotateRight"
    | "search"
    | "searchFolder"
    | "selectAll"
    | "selectMode"
    | "settings"
    | "share"
    | "sort"
    | "star"
    | "starBorder"
    | "upload"
    | "uploadFolder"
    | "videos"
    | "zoomFit"
    | "zoomIn"
    | "zoomOut";

/**
 * One icon component per semantic name, all of them: a Material style the package ships (`outlinedIcons`
 * by default, the others imported from `icons/<style>`), or a set of the app's own.
 */
export type IconSet = Record<IconName, IconComponent>;

/** Consumer-supplied replacements for individual icons, applied on top of the set. */
export type IconOverrides = Partial<IconSet>;

/**
 * A semantic name from the icon set, which follows the set `IconProvider` gives, or any element
 * such as an `<svg>` of the app's own, which is fitted to the same box.
 */
export type IconSource = IconName | ReactElement;
