import { useDropTarget } from "../../../hooks/use-drop-target";
import { useLocale } from "../../../hooks/use-locale";
import { fmClasses } from "../../../styles/classes";
import marks from "../../../styles/entry.module.css";
import { cx } from "../../../utils/cx";
import { belowElement } from "../../../utils/menu-position";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import IconSlot from "../../icons/icon-slot";
import ButtonBase from "../../ui/button-base";
import styles from "./path-bar.module.css";

import type { FileManagerLocation, FolderRef, IconSource, OpenMenu, Section } from "../../../types";

interface PathBarProps {
    section: Section;
    trail: FolderRef[];
    hasActions: boolean;
    onNavigate: (place: FileManagerLocation) => void;
    onOpenMenu: OpenMenu;
    /**
     * Types a path in the bar's place, from a press on its empty space or the touch screens' button.
     * Without it, the bar has neither, as in the transfer picker.
     */
    onEdit?: () => void;
}

interface Segment {
    id: string;
    label: string;
    icon?: IconSource;
}

interface CrumbProps {
    section: Section;
    segment: Segment;
    /** Trail to the segment's folder. */
    trail: FolderRef[];
    /** The open folder's. */
    current: boolean;
    onNavigate: (place: FileManagerLocation) => void;
}

// A press on the bar itself rather than on a segment or a button.
const onEmptySpace = (target: EventTarget) => target instanceof Element && !target.closest("button");

/**
 * A segment of the path, which opens its folder. Entries dragged onto it go into the folder, by the
 * same rules as pasting, and so do files from outside, as a tree row takes them. A drag resting on
 * it opens the folder, as GNOME's path bar does, and goes on there.
 */
const Crumb = ({ section, segment, trail, current, onNavigate }: CrumbProps) => {
    const open = () => onNavigate({ sectionId: section.id, trail });
    const drop = useDropTarget({
        targetsAt: () => [{ key: segment.id, section, trail }],
        onHold: current ? undefined : open,
    });

    return (
        <ButtonBase
            className={cx(fmClasses.pathSegment, styles.segment, marks.drag)}
            aria-current={current ? "location" : undefined}
            data-drop-target={drop.dropKey !== null}
            onClick={open}
            {...drop.handlers}
        >
            {segment.icon && <IconSlot icon={segment.icon} />}
            <bdi className={styles.label}>
                {segment.label}
            </bdi>
        </ButtonBase>
    );
};

/**
 * The section's name first, then the folders opened below its root. Its empty space, Ctrl+L and, on
 * touch screens, a button edit the path.
 */
const PathBar = ({ section, trail, hasActions, onNavigate, onOpenMenu, onEdit }: PathBarProps) => {
    const { text } = useLocale();
    const segments: Segment[] = [
        { id: section.rootId, label: section.label, icon: section.icon },
        ...trail.map((folder) => ({ id: folder.id, label: folder.name })),
    ];

    return (
        <nav
            aria-label={text.path}
            className={cx(onEdit ? styles.editableBar : styles.bar, fmClasses.pathBar)}
            // Keeps the focus where it is, to go back to as the field closes.
            onMouseDown={onEdit && ((event) => onEmptySpace(event.target) && event.preventDefault())}
            onClick={onEdit && ((event) => onEmptySpace(event.target) && onEdit())}
        >
            <div className={styles.scroller}>
                <ol className={styles.track}>
                    {segments.map((segment, index) => (
                        <li key={segment.id} className={styles.item}>
                            {index > 0 && (
                                <span aria-hidden className={styles.separator}>
                                    /
                                </span>
                            )}
                            <Crumb
                                section={section}
                                segment={segment}
                                trail={trail.slice(0, index)}
                                current={index === segments.length - 1}
                                onNavigate={onNavigate}
                            />
                        </li>
                    ))}
                </ol>
            </div>
            {onEdit && (
                <TooltipIconButton
                    size="small"
                    label={text.editPath}
                    aria-keyshortcuts="Control+L Meta+L"
                    className={styles.editButton}
                    onClick={onEdit}
                >
                    <Icon name="edit" fontSize="small" />
                </TooltipIconButton>
            )}
            {hasActions && (
                <TooltipIconButton
                    size="small"
                    label={text.folderMenu}
                    className={styles.menuButton}
                    onClick={(event) =>
                        onOpenMenu(belowElement(event.currentTarget), {
                            target: "folder",
                            section,
                            trail,
                            entries: [],
                        })
                    }
                >
                    <Icon name="more" fontSize="small" />
                </TooltipIconButton>
            )}
        </nav>
    );
};

export default PathBar;
