import type { SVGProps } from "react";

import { DefaultFolderOpenedIcon, FileIcon, FolderIcon } from "@react-symbols/icons/utils";

// The react-symbols SVGs ship with a viewBox but no width/height, so without a
// default size they stretch to fill their container. 1.5rem matches `Icon`'s.
const DEFAULT_SIZE = "1.5rem";

interface TypeIconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
    /** Width and height in one go; `width` / `height` still win when given. */
    size?: number | string;
}

interface FileTypeIconProps extends TypeIconProps {
    /** Full file name including extension, e.g. `report.pdf` or `vite.config.ts`. */
    fileName: string;
}

interface FolderTypeIconProps extends TypeIconProps {
    folderName: string;
    /** Render the opened-folder glyph instead of the name-based one. */
    open?: boolean;
}

/** Colored icon chosen from a file's name and extension; unknown files get a neutral default. */
export const FileTypeIcon = ({ fileName, size = DEFAULT_SIZE, ...props }: FileTypeIconProps) => (
    <FileIcon fileName={fileName} autoAssign width={size} height={size} aria-hidden {...props} />
);

/** Colored icon chosen from a folder's name; unknown folders get a neutral default. */
export const FolderTypeIcon = ({
    folderName,
    open = false,
    size = DEFAULT_SIZE,
    ...props
}: FolderTypeIconProps) =>
    open ? (
        <DefaultFolderOpenedIcon width={size} height={size} aria-hidden {...props} />
    ) : (
        <FolderIcon folderName={folderName} width={size} height={size} aria-hidden {...props} />
    );
