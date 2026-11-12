import type { Ref } from "react";

import { useLocale } from "../../hooks/use-locale";
import { KIND_ICONS } from "../../utils/media";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import IconSlot from "../icons/icon-slot";
import ButtonBase from "../ui/button-base";
import Text from "../ui/text";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./library-list.module.css";

import type { MediaSectionGroup } from "../../types";

interface LibraryListProps {
    ref: Ref<HTMLElement>;
    groups: readonly MediaSectionGroup[];
    /** The id of the library shown. */
    openId: string | undefined;
    /** Whether the drawer is open, where the list doesn't dock. */
    open: boolean;
    onOpen: (sectionId: string) => void;
    /** Closes the drawer. */
    onClose: () => void;
}

/**
 * The libraries, the sections in their groups, as a list of places the library shows one of:
 * docked beside it where there's room, or a drawer over it.
 */
const LibraryList = ({ ref, groups, openId, open, onOpen, onClose }: LibraryListProps) => {
    const { text } = useLocale();

    return (
        <nav
            ref={ref}
            tabIndex={-1}
            aria-label={text.mediaLibraries}
            className={cx(styles.list, fmClasses.mediaLibraries)}
            data-open={open}
            onKeyDown={(event) => {
                if (event.key === "Escape" && open && !event.defaultPrevented) {
                    event.preventDefault();
                    onClose();
                }
            }}
        >
            <div className={styles.header}>
                <Text component="h2" noWrap className={styles.title}>
                    {text.mediaLibraries}
                </Text>
                <TooltipIconButton label={text.mediaCloseLibraries} onClick={onClose}>
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </div>
            {groups.map((group) =>
                group.sections.length === 0 ? null : (
                    <section key={group.id} aria-label={group.title}>
                        {group.title && (
                            <Text variant="caption" component="h3" className={styles.groupTitle}>
                                {group.title}
                            </Text>
                        )}
                        {group.sections.map((section) => (
                            <ButtonBase
                                key={section.id}
                                className={cx(styles.row, fmClasses.mediaLibrary)}
                                aria-current={section.id === openId ? "page" : undefined}
                                onClick={() => onOpen(section.id)}
                            >
                                <IconSlot icon={section.icon ?? KIND_ICONS[section.kind]} />
                                <Text variant="body2" noWrap className={styles.label}>
                                    {section.label}
                                </Text>
                            </ButtonBase>
                        ))}
                    </section>
                ),
            )}
        </nav>
    );
};

export default LibraryList;
