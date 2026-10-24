import { useRef } from "react";
import type { KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { focusRing, forcedColors, visuallyHiddenSx } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import { isRtl } from "../../../utils/dom";
import Icon from "../../icons/icon";

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

// Scrolls sideways when the tabs don't fit, without a scrollbar, as the path bar does.
const tablistSx: SxProps<Theme> = {
    flexShrink: 0,
    display: "flex",
    gap: 0.5,
    paddingInline: 1.5,
    borderBottom: 1,
    borderColor: "divider",
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
};

// The open tab is underlined, by a bar drawn inside its edge, inset alike on both sides.
const tabSx: SxProps<Theme> = {
    flexShrink: 0,
    position: "relative",
    gap: 0.75,
    height: 40,
    px: 1.25,
    borderRadius: 1,
    color: "text.secondary",
    fontSize: "0.875rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
    "&:hover": { color: "text.primary" },
    "&::after": {
        content: '""',
        position: "absolute",
        insetInline: "0.5rem",
        bottom: 0,
        height: 2,
        borderRadius: 1,
        bgcolor: "primary.main",
        opacity: 0,
    },
    '&[aria-selected="true"]': { color: "text.primary" },
    '&[aria-selected="true"]::after': { opacity: 1 },
    [forcedColors]: { "&::after": { bgcolor: "Highlight" } },
    ...focusRing,
};

const countSx: SxProps<Theme> = {
    minWidth: "1.5rem",
    px: 0.75,
    borderRadius: 999,
    bgcolor: "action.hover",
    color: "text.secondary",
    fontSize: "0.75rem",
    lineHeight: "1.25rem",
    textAlign: "center",
};

const errorSx: SxProps<Theme> = {
    fontSize: "1rem",
    color: "error.main",
};

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
        <Box role="tablist" aria-label={text.searchTabs} sx={tablistSx} onKeyDown={handleKeyDown}>
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
                    sx={tabSx}
                    onClick={() => onChange(tab.id)}
                >
                    <bdi>{tab.label}</bdi>
                    {tab.status === "searching" && <CircularProgress size={12} aria-label={text.loading} />}
                    {tab.status === "error" && (
                        <>
                            <Icon name="info" sx={errorSx} />
                            <Box component="span" sx={visuallyHiddenSx}>
                                {text.searchFailed(isolate(tab.label))}
                            </Box>
                        </>
                    )}
                    {tab.status === "ready" && (
                        <>
                            <Box component="span" sx={countSx} aria-hidden>
                                {locale.formatNumber(tab.count)}
                            </Box>
                            <Box component="span" sx={visuallyHiddenSx}>
                                {text.searchResultCount(tab.count)}
                            </Box>
                        </>
                    )}
                </ButtonBase>
            ))}
        </Box>
    );
};

export default SearchTabs;
