import { useRef } from "react";
import type { KeyboardEvent } from "react";

import { useLocale } from "../../../hooks/use-locale";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import util from "../../../styles/util.module.css";
import { isolate } from "../../../utils/bidi";
import { isRtl } from "../../../utils/dom";
import Icon from "../../icons/icon";
import ButtonBase from "../../ui/button-base";
import CircularProgress from "../../ui/circular-progress";
import styles from "./search-tabs.module.css";

import type { SectionSearch } from "../../../types";

/** One tab: every section's results (`id` null) or one section's. */
export interface ResultTab {
    id: string | null;
    label: string;
    /** How the search of what the tab shows stands, and how many it has found. */
    status: SectionSearch["status"];
    count: number;
}

interface SearchTabsProps {
    tabs: ResultTab[];
    /** The open tab's id. */
    value: string | null;
    /** Each tab's element id is this, then its place. */
    idPrefix: string;
    /** The id of the panel the tabs show results in. */
    panelId: string;
    onChange: (id: string | null) => void;
}

/** The id of the tab at `index`, which names the panel while it's open. */
export const tabId = (idPrefix: string, index: number) => `${idPrefix}-${index}`;

/**
 * The tabs of a search everywhere's results: every section's, then each section's on its own. They
 * only choose which results show, not which sections are searched, which the search field's
 * sections menu does. One tab stop: Left and Right, Home and End move between the tabs and open
 * them as they go, as a tablist does.
 */
const SearchTabs = ({ tabs, value, idPrefix, panelId, onChange }: SearchTabsProps) => {
    const locale = useLocale();
    const { text } = locale;
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const open = Math.max(
        tabs.findIndex((tab) => tab.id === value),
        0,
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            return;
        }

        const forward = isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight";
        const backward = isRtl(event.currentTarget) ? "ArrowRight" : "ArrowLeft";
        let index: number;

        if (event.key === forward) {
            index = Math.min(open + 1, tabs.length - 1);
        } else if (event.key === backward) {
            index = Math.max(open - 1, 0);
        } else if (event.key === "Home") {
            index = 0;
        } else if (event.key === "End") {
            index = tabs.length - 1;
        } else {
            return;
        }

        event.preventDefault();
        onChange(tabs[index].id);
        tabRefs.current[index]?.focus();
    };

    return (
        <div role="tablist" aria-label={text.searchTabs} className={cx(styles.tablist, fmClasses.searchTabs)} onKeyDown={handleKeyDown}>
            {tabs.map((tab, index) => (
                <ButtonBase
                    key={tab.id ?? ""}
                    ref={(element: HTMLButtonElement | null) => {
                        tabRefs.current[index] = element;
                    }}
                    id={tabId(idPrefix, index)}
                    role="tab"
                    aria-selected={index === open}
                    aria-controls={panelId}
                    tabIndex={index === open ? 0 : -1}
                    className={cx(styles.tab, fmClasses.searchTab)}
                    onClick={() => onChange(tab.id)}
                >
                    <bdi>{tab.label}</bdi>
                    {tab.status === "searching" && <CircularProgress size={12} aria-label={text.loading} />}
                    {tab.status === "error" && (
                        <>
                            <Icon name="info" className={styles.error} />
                            <span className={util.visuallyHidden}>
                                {text.searchFailed(isolate(tab.label))}
                            </span>
                        </>
                    )}
                    {tab.status === "ready" && (
                        <>
                            <span className={styles.count} aria-hidden>
                                {locale.formatNumber(tab.count)}
                            </span>
                            <span className={util.visuallyHidden}>
                                {text.searchResultCount(tab.count)}
                            </span>
                        </>
                    )}
                </ButtonBase>
            ))}
        </div>
    );
};

export default SearchTabs;
