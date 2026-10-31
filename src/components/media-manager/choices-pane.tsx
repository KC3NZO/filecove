import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { mediaWide } from "../../styles/media-layout";
import { focusOutline, forcedColors, visuallyHiddenSx } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { focusLost } from "../../utils/dom";
import { KIND_ICONS } from "../../utils/media";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import ChoiceList, { choiceKey } from "./choice-list";

import type { FileAdapter, MediaChoice } from "../../types";

interface ChoicesPaneProps {
    /** What's selected, in every library, in the order it's handed over in. */
    choices: readonly MediaChoice[];
    /** Serves the libraries that don't bring their own adapter, for the thumbnails. */
    adapter: FileAdapter;
    /**
     * Whether several can be chosen, listed to put in order; one at a time, the one selected shows
     * straight away with its details, as there's nothing to order.
     */
    multiple: boolean;
    /** The app's fields for one pick, for this use of it, drawn with what they hold; none without them. */
    renderDetails: ((choice: MediaChoice) => ReactNode) | undefined;
    onRemove: (choice: MediaChoice) => void;
    onMove: (from: number, to: number) => void;
    onClear: () => void;
    onChoose: () => void;
    /** Opens the asset itself in its library, in the library's place. */
    onShowInLibrary: (choice: MediaChoice) => void;
    /** Closes the column where it's an overlay over the library. */
    onClose: () => void;
}

interface ChoiceDetailsProps {
    choice: MediaChoice;
    adapter: FileAdapter;
    children: ReactNode;
    onShowInLibrary: () => void;
}

const paneSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    outline: "none",
    "&:focus-visible": { ...focusOutline, borderRadius: "inherit" },
};

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    flexShrink: 0,
    minHeight: 52,
    paddingInlineStart: 2,
    paddingInlineEnd: 1,
};

const backHeaderSx: SxProps<Theme> = {
    ...headerSx,
    paddingInlineStart: 0.5,
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const countSx: SxProps<Theme> = {
    marginInlineStart: 1,
    px: 0.75,
    borderRadius: 2,
    bgcolor: "action.selected",
    color: "text.primary",
    fontSize: "0.75rem",
    fontWeight: 700,
    lineHeight: "20px",
    [forcedColors]: { outline: "1px solid CanvasText" },
};

// Only where the column is an overlay; docked, it's always there.
const closeSx: SxProps<Theme> = {
    [mediaWide]: { display: "none" },
};

const emptySx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
    flex: 1,
    px: 3,
    color: "text.secondary",
    textAlign: "center",
    "& > svg": { fontSize: 40, opacity: 0.6 },
};

const footerSx: SxProps<Theme> = {
    display: "flex",
    flexShrink: 0,
    p: 1.5,
    borderTop: 1,
    borderColor: "divider",
    "& > button": { flex: 1 },
};

const detailsSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    px: 2,
    pb: 2,
};

const heroSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    pb: 2,
    mb: 2,
    borderBottom: 1,
    borderColor: "divider",
};

const pictureSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "5.5rem",
    height: "5.5rem",
    borderRadius: 2,
    overflow: "hidden",
    bgcolor: "action.hover",
    color: "text.secondary",
    "& > img": { width: "100%", height: "100%", objectFit: "cover" },
    [forcedColors]: { outline: "1px solid CanvasText" },
};

const heroTextSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 0.25,
    minWidth: 0,
};

const nameSx: SxProps<Theme> = {
    maxWidth: "100%",
    fontWeight: 600,
    fontSize: "0.875rem",
    overflowWrap: "anywhere",
};

const librarySx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

const showSx: SxProps<Theme> = {
    mt: 0.5,
    marginInlineStart: -1,
};

/** One pick's details: what it is, a way to the asset itself, and the app's own fields for this use of it. */
const ChoiceDetails = ({ choice, adapter, children, onShowInLibrary }: ChoiceDetailsProps) => {
    const { text } = useLocale();
    const { asset, section } = choice;
    const thumbnail = useThumbnail(asset, section.adapter ?? adapter, "grid", 5.5);

    return (
        <Box sx={detailsSx}>
            <Box sx={heroSx}>
                <Box sx={pictureSx}>
                    {thumbnail ? (
                        <img src={thumbnail} alt="" draggable={false} />
                    ) : section.kind === "audio" ? (
                        <Icon name={KIND_ICONS.audio} />
                    ) : (
                        <FileTypeIcon fileName={asset.name} size="50%" />
                    )}
                </Box>
                <Box sx={heroTextSx}>
                    <Typography component="p" sx={nameSx}>
                        <bdi>{asset.name}</bdi>
                    </Typography>
                    <Typography variant="caption" sx={librarySx}>
                        {section.label}
                    </Typography>
                    <Button size="small" sx={showSx} onClick={onShowInLibrary}>
                        {text.mediaShowInLibrary}
                    </Button>
                </Box>
            </Box>
            {children}
        </Box>
    );
};

/**
 * The column of what's selected, in every library, while the app takes a choice: the list to put
 * in order, each pick's details, the app's own fields for this use of it, and Choose; one at a
 * time, the one selected with its details, and no list. Docked at
 * the media manager's end side where there's room, and an overlay over the library where there
 * isn't.
 */
const ChoicesPane = ({
    choices,
    adapter,
    multiple,
    renderDetails,
    onRemove,
    onMove,
    onClear,
    onChoose,
    onShowInLibrary,
    onClose,
}: ChoicesPaneProps) => {
    const { text, formatNumber } = useLocale();
    const titleId = useId();
    const paneRef = useRef<HTMLElement>(null);
    const backRef = useRef<HTMLButtonElement>(null);
    const [detailsKey, setDetailsKey] = useState<string | null>(null);
    // The one whose details closed with the focus in them, which takes it back in the list.
    const [returnFocus, setReturnFocus] = useState<string | null>(null);
    const count = choices.length;
    const open = detailsKey === null ? undefined : choices.find((choice) => choiceKey(choice) === detailsKey);
    // One at a time, the one selected, shown with its details in the list's place.
    const only = multiple ? undefined : choices[0];

    // A pick taken out, or chosen past, closes its details.
    if (detailsKey !== null && (!open || !renderDetails)) {
        setDetailsKey(null);
    }

    // The details take the focus as they open, on their way back.
    useEffect(() => {
        if (detailsKey !== null) {
            backRef.current?.focus();
        }
    }, [detailsKey]);

    // The list has taken it back as it mounted, in a layout effect, before this runs; it's forgotten,
    // so the list mounting again later, as something is selected after none, doesn't take it.
    useEffect(() => {
        if (returnFocus !== null) {
            setReturnFocus(null);
        }
    }, [returnFocus]);

    // The last one taken out, or Clear selection, had the focus, and went with it: the column takes
    // it, so it isn't lost.
    useEffect(() => {
        if (count === 0 && focusLost()) {
            paneRef.current?.focus();
        }
    }, [count]);

    const closeDetails = () => {
        setReturnFocus(paneRef.current?.contains(document.activeElement) ? detailsKey : null);
        setDetailsKey(null);
    };

    const openDetails = (choice: MediaChoice) => {
        setReturnFocus(null);
        setDetailsKey(choiceKey(choice));
    };

    return (
        <Box
            component="section"
            ref={paneRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            sx={paneSx}
            onKeyDown={(event) => {
                if (event.key === "Escape" && open && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeDetails();
                }
            }}
        >
            {open && renderDetails ? (
                <>
                    <Box sx={backHeaderSx}>
                        <TooltipIconButton ref={backRef} label={text.mediaChoicesBack} onClick={closeDetails}>
                            <Icon name="arrowBack" fontSize="small" />
                        </TooltipIconButton>
                        <Typography id={titleId} component="h2" noWrap sx={titleSx}>
                            {text.mediaChoiceDetails(isolate(open.asset.name))}
                        </Typography>
                        <TooltipIconButton label={text.mediaCloseChosen} sx={closeSx} onClick={onClose}>
                            <Icon name="close" fontSize="small" />
                        </TooltipIconButton>
                    </Box>
                    <ChoiceDetails
                        key={detailsKey}
                        choice={open}
                        adapter={adapter}
                        onShowInLibrary={() => onShowInLibrary(open)}
                    >
                        {renderDetails(open)}
                    </ChoiceDetails>
                </>
            ) : (
                <>
                    <Box sx={headerSx}>
                        <Typography id={titleId} component="h2" noWrap sx={titleSx}>
                            {text.mediaChosen}
                            {multiple && count > 0 && (
                                <Box component="span" sx={countSx} aria-hidden>
                                    {formatNumber(count)}
                                </Box>
                            )}
                        </Typography>
                        {count > 0 && (
                            <Button size="small" color="inherit" onClick={onClear}>
                                {text.mediaClearSelection}
                            </Button>
                        )}
                        <TooltipIconButton label={text.mediaCloseChosen} sx={closeSx} onClick={onClose}>
                            <Icon name="close" fontSize="small" />
                        </TooltipIconButton>
                    </Box>
                    {only ? (
                        <ChoiceDetails
                            key={choiceKey(only)}
                            choice={only}
                            adapter={adapter}
                            onShowInLibrary={() => onShowInLibrary(only)}
                        >
                            {renderDetails?.(only)}
                        </ChoiceDetails>
                    ) : count > 0 ? (
                        <ChoiceList
                            choices={choices}
                            adapter={adapter}
                            hasDetails={!!renderDetails}
                            returnFocusTo={returnFocus}
                            onRemove={onRemove}
                            onMove={onMove}
                            onOpenDetails={openDetails}
                        />
                    ) : (
                        <Box sx={emptySx}>
                            <Icon name="selectAll" />
                            <Typography variant="body2">{text.mediaNothingChosen}</Typography>
                        </Box>
                    )}
                </>
            )}
            <Box sx={footerSx}>
                <Button variant="contained" disableElevation disabled={count === 0} onClick={onChoose}>
                    {text.mediaChoose}
                </Button>
            </Box>
            <Box role="status" sx={visuallyHiddenSx}>
                {count > 0 ? text.mediaSelected(count) : ""}
            </Box>
        </Box>
    );
};

export default ChoicesPane;
