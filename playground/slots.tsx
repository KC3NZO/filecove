import { Button, Text } from "./ui";
import styles from "./slots.module.css";

import type {
    ActionContext,
    ActionGroup,
    FileManagerEmptyProps,
    FileManagerSidebarFooterProps,
    FileManagerSlotProps,
    FileManagerSlots,
    MediaEmptyProps,
    MediaManagerSlots,
} from "../src";

// `?slots`: the file manager and the media manager with parts of the playground's own, as an app
// would add them (see `.claude/rules/slots.md`). Each slot is a component kept outside the app's
// own, and the objects are made once, so nothing draws again for them.

const names = (context: ActionContext) =>
    context.entries.length === 1 ? `“${context.entries[0].name}”` : `${context.entries.length} items`;

/**
 * The header's buttons: New folder and Upload files for the open folder, with nothing selected, and
 * Share for a selection, also taking a search's results from several folders.
 */
export const createHeaderActions = (notify: (message: string) => void): ActionGroup[] => [
    {
        id: "header-folder",
        actions: [
            {
                id: "header-new-folder",
                label: "New folder…",
                icon: "newFolder",
                target: "folder",
                visible: (context) => !!context.createFolder,
                onSelect: (context) => context.createFolder?.(),
            },
            {
                id: "header-upload",
                label: "Upload files…",
                icon: "upload",
                target: "folder",
                visible: (context) => !!context.upload,
                onSelect: (context) => context.upload?.(),
            },
        ],
    },
    {
        id: "header-selection",
        actions: [
            {
                id: "header-share",
                label: "Share",
                icon: "share",
                target: "selection",
                acrossFolders: true,
                visible: (context) => !context.section.trash,
                onSelect: (context) => notify(`Share ${names(context)}`),
            },
        ],
    },
];

/** An empty folder offering to upload into it, through the same context the menus' actions get. */
const EmptyFolder = ({ folder, trash, context }: FileManagerEmptyProps) => (
    <div className={styles.empty}>
        <Text variant="h6" component="p">
            {trash ? "Nothing in the trash" : `“${folder.name}” is empty`}
        </Text>
        {!trash && (
            <Text variant="body2" color="secondary">
                {context?.upload ? "Drop files here, or upload them." : "Nothing can be added here."}
            </Text>
        )}
        {context?.upload && (
            <Button
                variant="contained"
                onClick={(event) => {
                    // Not the folder's empty space's own click, which would clear its selection.
                    event.stopPropagation();
                    context.upload?.();
                }}
            >
                Upload files
            </Button>
        )}
    </div>
);

// Made-up use of each section's backend, as an app would read it from its own.
const STORAGE: Record<string, { used: number; total: number }> = {
    "project-a": { used: 3.2, total: 15 },
    "project-b": { used: 11.6, total: 15 },
    design: { used: 41.5, total: 50 },
    media: { used: 120, total: 500 },
};

/** A storage meter under the sidebar's tree, for the section open, as Drive shows one. */
const StorageMeter = ({ section }: FileManagerSidebarFooterProps) => {
    const storage = (section && STORAGE[section.id]) ?? { used: 0.4, total: 2 };
    const share = storage.used / storage.total;

    return (
        <div className={styles.meter}>
            <div
                role="meter"
                aria-label="Storage used"
                aria-valuemin={0}
                aria-valuemax={storage.total}
                aria-valuenow={storage.used}
                aria-valuetext={`${storage.used} GB of ${storage.total} GB`}
                className={styles.track}
            >
                <div className={styles.fill} style={{ inlineSize: `${share * 100}%` }} data-full={share > 0.75} />
            </div>
            <Text variant="caption" color="secondary">
                {storage.used} GB of {storage.total} GB used
            </Text>
        </div>
    );
};

export const fileManagerSlots: FileManagerSlots = {
    empty: EmptyFolder,
    sidebarFooter: StorageMeter,
};

/** Dotfiles in italics, by a class the app gives each entry, and a test id on the content panel. */
export const fileManagerSlotProps: FileManagerSlotProps = {
    content: { "data-testid": "file-manager-content" },
    entry: ({ entry }) => (entry.name.startsWith(".") ? { className: styles.dotfile } : undefined),
};

/** An empty library or group offering to upload into it. */
const EmptyLibrary = ({ section, group, upload }: MediaEmptyProps) => (
    <div className={styles.empty}>
        <Text variant="h6" component="p">
            Nothing in {group?.name ?? section.label} yet
        </Text>
        {upload && (
            <Button variant="contained" onClick={upload}>
                Upload {section.kind === "image" ? "pictures" : "files"}
            </Button>
        )}
    </div>
);

export const mediaManagerSlots: MediaManagerSlots = {
    empty: EmptyLibrary,
};
