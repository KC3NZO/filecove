import type { ReactElement } from "react";

import type SvgIcon from "@mui/material/SvgIcon";

export type IconComponent = typeof SvgIcon;

export type IconVariant = "filled" | "outlined" | "rounded" | "sharp" | "twoTone";

export type IconName =
    | "add"
    | "arrowBack"
    | "arrowDown"
    | "arrowForward"
    | "arrowUp"
    | "check"
    | "chevronRight"
    | "close"
    | "copy"
    | "cut"
    | "delete"
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
    | "gridView"
    | "home"
    | "info"
    | "listView"
    | "menu"
    | "more"
    | "move"
    | "music"
    | "network"
    | "newFolder"
    | "paste"
    | "pictures"
    | "recent"
    | "refresh"
    | "rename"
    | "search"
    | "selectAll"
    | "selectMode"
    | "settings"
    | "share"
    | "sort"
    | "star"
    | "starBorder"
    | "upload"
    | "videos";

/** One icon component per semantic name; every variant must provide all of them. */
export type IconSet = Record<IconName, IconComponent>;

/** Consumer-supplied replacements for individual icons, applied on top of any variant. */
export type IconOverrides = Partial<IconSet>;

/**
 * A semantic name from the icon set, which follows the consumer's icon variant, or any element
 * such as `<CloudOutlined />`, which is fitted to the same box.
 */
export type IconSource = IconName | ReactElement;
