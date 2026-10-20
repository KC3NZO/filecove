import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFolder } from "../../../hooks/use-folder";
import { clashingNames, useTransfer } from "../../../hooks/use-transfer";
import { dialogPaperSx, hoverBackground } from "../../../styles/mixins";
import { folderOf } from "../../../utils/navigation";
import { compareEntries } from "../../../utils/sort";
import { FolderTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
import PathBar from "../header-bar/path-bar";
import IconSlot from "../icon-slot";
import { ConflictChoices, ConflictMessage } from "./conflict-step";

import type { ConflictPolicy, FileAdapter, FileEntry, FolderRef, OpenMenu, Place, Section } from "../../../types";

export interface TransferRequest {
    kind: "copy" | "move";
    section: Section;
    /** The section's adapter, already known to support the request. */
    adapter: FileAdapter;
    /** Trail to the folder the entries are in. */
    trail: FolderRef[];
    entries: FileEntry[];
    /**
     * Sections served by the same adapter, the only ones whose ids it understands, that take
     * entries from `section`, which is always among them.
     */
    destinations: Section[];
}

export interface TransferDialogState {
    /** False while the dialog plays its closing transition; the rest is kept so it doesn't empty mid-fade. */
    open: boolean;
    /** Counts requests, so each one starts afresh. */
    id: number;
    request: TransferRequest;
}

interface TransferDialogProps {
    open: boolean;
    request: TransferRequest;
    onClose: () => void;
    /** Called once the adapter has copied or moved the entries into `destination`. */
    onDone: (request: TransferRequest, destination: Place) => void;
}

const NO_MENU: OpenMenu = () => false;

const slotProps = {
    paper: { sx: dialogPaperSx },
};

const contentSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    height: "min(24rem, 60vh)",
};

const toolbarSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    minHeight: 34,
};

const locationSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
};

// The bordered box the folders fill, shared by the list and its loading, empty and error states.
// It takes the content panel's surface, as the dialog takes the window's, so it reads as the same view.
const frame = {
    flex: 1,
    minHeight: 0,
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
};

// Not a flex container: `ListItemButton` grows along a flex axis, which would stretch every row.
const listSx: SxProps<Theme> = {
    ...frame,
    overflowY: "auto",
    py: 0.5,
};

const emptySx: SxProps<Theme> = {
    ...frame,
    display: "flex",
};

const rowSx: SxProps<Theme> = (theme) => ({
    mx: 0.5,
    borderRadius: 1.5,
    "&:hover": { bgcolor: hoverBackground(theme) },
});

const rowIconSx: SxProps<Theme> = {
    minWidth: 36,
};

const stateSx: SxProps<Theme> = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    p: 2,
    textAlign: "center",
    color: "text.secondary",
};

const spacerSx: SxProps<Theme> = {
    flex: 1,
};

const isFolder = (entry: FileEntry) => entry.kind === "folder";

/**
 * Asks where to copy or move entries, then has the adapter do it. It browses folders only, across
 * the sections the adapter serves that take entries from theirs, starting in the entries' own
 * folder. The entries themselves can't be opened, so a folder can never go into itself. Names the
 * destination already has are settled in a second step: replace, keep both, or skip.
 */
const TransferDialog = ({ open, request, onClose, onDone }: TransferDialogProps) => {
    const { kind, section, trail, entries, destinations } = request;
    const sourceId = folderOf(section, trail).id;

    // Null on the list of sections, which is only reachable with more than one.
    const [place, setPlace] = useState<Place | null>({ sectionId: section.id, trail });
    const [conflicts, setConflicts] = useState<string[] | null>(null);

    const target = destinations.find((candidate) => candidate.id === place?.sectionId) ?? section;
    const targetFolder = folderOf(target, place?.trail ?? []);
    const { state, reload } = useFolder(target, targetFolder.id, place !== null);
    const source = useFolder(section, sourceId, false);

    const folders = useMemo(() => state?.entries?.filter(isFolder).sort(compareEntries), [state?.entries]);
    const movingIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);

    // Ids are unique within an adapter, so the same folder is the same id whichever section shows it.
    const sameFolder = place !== null && targetFolder.id === sourceId;
    const verb = kind === "copy" ? "Copy" : "Move";
    const what = entries.length === 1 ? `“${entries[0].name}”` : `${entries.length} items`;

    // The adapter can't undo a change it has made, so both folders are listed again however it ended.
    const refresh = () => {
        reload();

        if (kind === "move") {
            source.reload();
        }
    };

    const { pending, failure, run: start, cancel, clearFailure } = useTransfer(request, refresh);

    const go = (next: Place | null) => {
        if (!pending) {
            setPlace(next);
            clearFailure();
        }
    };

    const goUp = () => {
        if (place?.trail.length) {
            go({ ...place, trail: place.trail.slice(0, -1) });
        } else {
            go(null);
        }
    };

    const run = (conflict: ConflictPolicy) => {
        if (!place) {
            return;
        }

        const destination = place;

        start(targetFolder.id, conflict).then((outcome) => {
            if (outcome === "done") {
                onDone(request, destination);
            } else if (outcome === "failed") {
                setConflicts(null);
            }
        });
    };

    // Copying into the entries' own folder clashes with every one of them, and only makes sense as
    // a duplicate, so it keeps both without asking.
    const confirm = () => {
        const clashes = clashingNames(entries, state?.entries);

        if (clashes.length > 0 && !sameFolder) {
            setConflicts(clashes);
        } else {
            run("keepBoth");
        }
    };

    const close = () => {
        cancel();
        onClose();
    };

    let body: ReactNode;

    if (conflicts) {
        body = (
            <Box sx={stateSx}>
                <ConflictMessage names={conflicts} folderName={targetFolder.name} />
            </Box>
        );
    } else if (!place) {
        body = (
            <List dense sx={listSx}>
                {destinations.map((candidate) => (
                    <ListItemButton key={candidate.id} sx={rowSx} onClick={() => go({ sectionId: candidate.id, trail: [] })}>
                        <ListItemIcon sx={rowIconSx}>
                            <IconSlot icon={candidate.icon ?? "folder"} />
                        </ListItemIcon>
                        <ListItemText primary={candidate.label} />
                    </ListItemButton>
                ))}
            </List>
        );
    } else if (folders?.length) {
        body = (
            <List dense sx={listSx}>
                {folders.map((folder) => (
                    <ListItemButton
                        key={folder.id}
                        sx={rowSx}
                        disabled={movingIds.has(folder.id)}
                        onClick={() => go({ ...place, trail: [...place.trail, { id: folder.id, name: folder.name }] })}
                    >
                        <ListItemIcon sx={rowIconSx}>
                            <FolderTypeIcon folderName={folder.name} size="1.25rem" />
                        </ListItemIcon>
                        <ListItemText primary={folder.name} />
                    </ListItemButton>
                ))}
            </List>
        );
    } else {
        body = (
            <Box sx={emptySx}>
                <Box sx={stateSx}>
                    {folders && <Typography variant="body2">No folders</Typography>}
                    {!folders && state?.status === "error" && (
                        <Typography variant="body2">
                            Couldn't open this folder{state.error instanceof Error && `: ${state.error.message}`}
                        </Typography>
                    )}
                    {!folders && state?.status !== "error" && <CircularProgress size={24} />}
                </Box>
            </Box>
        );
    }

    return (
        <Dialog open={open} fullWidth maxWidth="sm" slotProps={slotProps} onClose={close}>
            <DialogTitle>
                {verb} {what} to…
            </DialogTitle>
            <DialogContent sx={contentSx}>
                {!conflicts && (
                    <Box sx={toolbarSx}>
                        <IconButton
                            size="small"
                            aria-label="Back"
                            disabled={!place || (place.trail.length === 0 && destinations.length < 2)}
                            onClick={goUp}
                        >
                            <Icon name="arrowBack" fontSize="small" />
                        </IconButton>
                        <Box sx={locationSx}>
                            {place ? (
                                <PathBar
                                    section={target}
                                    trail={place.trail}
                                    hasActions={false}
                                    onNavigate={go}
                                    onOpenMenu={NO_MENU}
                                />
                            ) : (
                                <Typography variant="body2" fontWeight={600}>
                                    Locations
                                </Typography>
                            )}
                        </Box>
                    </Box>
                )}
                {body}
                {failure && (
                    <Typography variant="body2" color="error">
                        {failure}
                    </Typography>
                )}
            </DialogContent>
            {conflicts ? (
                <DialogActions>
                    <Button color="inherit" disabled={!!pending} onClick={() => setConflicts(null)}>
                        Back
                    </Button>
                    <Box sx={spacerSx} />
                    <ConflictChoices pending={pending} onChoose={run} />
                </DialogActions>
            ) : (
                <DialogActions>
                    <Button color="inherit" onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!place || (kind === "move" && sameFolder)}
                        loading={!!pending}
                        onClick={confirm}
                    >
                        {verb} here
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
};

export default TransferDialog;
