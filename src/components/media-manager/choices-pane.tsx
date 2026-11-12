import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useLocale } from "../../hooks/use-locale";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import util from "../../styles/util.module.css";
import { isolate } from "../../utils/bidi";
import { focusLost } from "../../utils/dom";
import { KIND_ICONS } from "../../utils/media";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import Button from "../ui/button";
import Text from "../ui/text";
import { HoldLine } from "./asset-hold";
import ChoiceList, { choiceKey } from "./choice-list";
import styles from "./choices-pane.module.css";

import type { AssetHold, FileAdapter, MediaChoice } from "../../types";

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
    /**
     * One pick's own errors and the app's form for it, for this use of it, drawn with what it holds,
     * by its place among those selected now; none without either.
     */
    renderDetails: ((choice: MediaChoice, index: number) => ReactNode) | undefined;
    /** How much of a pick the app's `errors` have to fix, for its row; none without them. */
    problemsOf: ((choice: MediaChoice) => number) | undefined;
    /** Why a pick can't be chosen now, for its row and its details. */
    holdOf: (choice: MediaChoice) => AssetHold | undefined;
    /** What holds Choose back, said beside it, while picks can't be chosen; nothing otherwise. */
    held: string | undefined;
    /** What the count beside its title shows; nothing one at a time, or with none and no limit. */
    badge: string | undefined;
    /** How many are selected, in words, for screen readers. */
    selectedText: string | undefined;
    /** That as many as may be are selected, said under its header. */
    note: string | undefined;
    onRemove: (choice: MediaChoice) => void;
    onMove: (from: number, to: number) => void;
    onClear: () => void;
    /** Choose at its foot, while finishing is the app's to take; without it, the app takes the picks as they change. */
    onChoose: (() => void) | undefined;
    /** Opens the asset itself in its library, in the library's place; none where there's no asset view. */
    onShowInLibrary: ((choice: MediaChoice) => void) | undefined;
    /** Closes the column where it's an overlay over the library. */
    onClose: () => void;
}

interface ChoiceDetailsProps {
    choice: MediaChoice;
    adapter: FileAdapter;
    hold: AssetHold | undefined;
    children: ReactNode;
    onShowInLibrary: (() => void) | undefined;
}

/** One pick's details: what it is, a way to the asset itself, and the app's own form for this use of it. */
const ChoiceDetails = ({ choice, adapter, hold, children, onShowInLibrary }: ChoiceDetailsProps) => {
    const { text } = useLocale();
    const { asset, section } = choice;
    const thumbnail = useThumbnail(asset, section.adapter ?? adapter, "grid", 5.5);

    return (
        <div className={styles.details}>
            <div className={styles.hero}>
                <div className={styles.picture}>
                    {thumbnail ? (
                        <img src={thumbnail} alt="" draggable={false} />
                    ) : asset.kind === "folder" ? (
                        <Icon name="folder" />
                    ) : section.kind === "audio" ? (
                        <Icon name={KIND_ICONS.audio} />
                    ) : (
                        <FileTypeIcon fileName={asset.name} size="50%" />
                    )}
                </div>
                <div className={styles.heroText}>
                    <Text component="p" className={styles.name}>
                        <bdi>{asset.name}</bdi>
                    </Text>
                    <Text variant="caption" className={styles.library}>
                        {section.label}
                    </Text>
                    {hold && <HoldLine hold={hold} />}
                    {onShowInLibrary && (
                        <Button size="small" className={styles.show} onClick={onShowInLibrary}>
                            {text.mediaShowInLibrary}
                        </Button>
                    )}
                </div>
            </div>
            {children}
        </div>
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
    problemsOf,
    holdOf,
    held,
    badge,
    selectedText,
    note,
    onRemove,
    onMove,
    onClear,
    onChoose,
    onShowInLibrary,
    onClose,
}: ChoicesPaneProps) => {
    const { text } = useLocale();
    const titleId = useId();
    const heldId = useId();
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
        <section
            ref={paneRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            className={cx(styles.pane, fmClasses.mediaChosen)}
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
                    <div className={styles.backHeader}>
                        <TooltipIconButton ref={backRef} label={text.mediaChoicesBack} onClick={closeDetails}>
                            <Icon name="arrowBack" fontSize="small" />
                        </TooltipIconButton>
                        <Text id={titleId} component="h2" noWrap className={styles.title}>
                            {text.mediaChoiceDetails(isolate(open.asset.name))}
                        </Text>
                        <TooltipIconButton label={text.mediaCloseChosen} className={styles.close} onClick={onClose}>
                            <Icon name="close" fontSize="small" />
                        </TooltipIconButton>
                    </div>
                    <ChoiceDetails
                        key={detailsKey}
                        choice={open}
                        adapter={adapter}
                        hold={holdOf(open)}
                        onShowInLibrary={onShowInLibrary && (() => onShowInLibrary(open))}
                    >
                        {renderDetails(open, choices.indexOf(open))}
                    </ChoiceDetails>
                </>
            ) : (
                <>
                    <div className={styles.header}>
                        <Text id={titleId} component="h2" noWrap className={styles.title}>
                            {text.mediaChosen}
                            {badge && (
                                <span className={styles.count} aria-hidden>
                                    {badge}
                                </span>
                            )}
                        </Text>
                        {count > 0 && (
                            <Button size="small" color="inherit" onClick={onClear}>
                                {text.mediaClearSelection}
                            </Button>
                        )}
                        <TooltipIconButton label={text.mediaCloseChosen} className={styles.close} onClick={onClose}>
                            <Icon name="close" fontSize="small" />
                        </TooltipIconButton>
                    </div>
                    {note && (
                        <Text component="p" className={styles.note}>
                            {note}
                        </Text>
                    )}
                    {only ? (
                        <ChoiceDetails
                            key={choiceKey(only)}
                            choice={only}
                            adapter={adapter}
                            hold={holdOf(only)}
                            onShowInLibrary={onShowInLibrary && (() => onShowInLibrary(only))}
                        >
                            {renderDetails?.(only, 0)}
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
                            problemsOf={problemsOf}
                            holdOf={holdOf}
                        />
                    ) : (
                        <div className={styles.empty}>
                            <Icon name="selectAll" />
                            <Text variant="body2">{text.mediaNothingChosen}</Text>
                        </div>
                    )}
                </>
            )}
            {onChoose && (
                <div className={styles.footer}>
                    {held && (
                        <Text id={heldId} variant="body2" className={styles.held}>
                            {held}
                        </Text>
                    )}
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={count === 0 || !!held}
                        aria-describedby={held ? heldId : undefined}
                        onClick={onChoose}
                    >
                        {text.mediaChoose}
                    </Button>
                </div>
            )}
            <div role="status" className={util.visuallyHidden}>
                {count > 0 ? selectedText : ""}
            </div>
        </section>
    );
};

export default ChoicesPane;
