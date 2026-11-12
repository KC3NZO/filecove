import type { SVGProps } from "react";

import { useTypeIcons } from "../../hooks/use-type-icons";
import { cx } from "../../utils/cx";
import Icon from "./icon";
import styles from "./icon.module.css";

import type { IconName } from "../../types";

// The react-symbols SVGs ship with a viewBox but no width/height, so without a
// default size they stretch to fill their container. 1.5rem matches `Icon`'s.
const DEFAULT_SIZE = "1.5rem";

interface TypeIconProps extends Omit<SVGProps<SVGSVGElement>, "ref" | "name" | "fontSize"> {
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

/**
 * The icon set's own file or folder icon, in the icons' colour, while the coloured ones load or
 * when `IconProvider` turned them off. Sized by `style`, as `Icon`'s class sizes it otherwise.
 */
const PlainIcon = ({
    name,
    size,
    width,
    height,
    className,
    style,
    ...props
}: TypeIconProps & { name: IconName }) => (
    <Icon
        name={name}
        {...props}
        className={cx(styles.plain, className)}
        style={{ width: width ?? size, height: height ?? size, ...style }}
    />
);

/** Colored icon chosen from a file's name and extension; unknown files get a neutral default. */
export const FileTypeIcon = ({ fileName, size = DEFAULT_SIZE, ...props }: FileTypeIconProps) => {
    const icons = useTypeIcons();

    if (!icons) {
        return <PlainIcon name="file" size={size} {...props} />;
    }

    return <icons.FileIcon fileName={fileName} autoAssign width={size} height={size} aria-hidden {...props} />;
};

/** Colored icon chosen from a folder's name; unknown folders get a neutral default. */
export const FolderTypeIcon = ({ folderName, open = false, size = DEFAULT_SIZE, ...props }: FolderTypeIconProps) => {
    const icons = useTypeIcons();

    if (!icons) {
        return <PlainIcon name={open ? "folderOpen" : "folder"} size={size} {...props} />;
    }

    return open ? (
        <icons.DefaultFolderOpenedIcon width={size} height={size} aria-hidden {...props} />
    ) : (
        <icons.FolderIcon folderName={folderName} width={size} height={size} aria-hidden {...props} />
    );
};
