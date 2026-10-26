import { useContext } from "react";

import { CutContext } from "../contexts/cut-context";
import { DataContext } from "../contexts/data-context";

import type { Section } from "../types";

const NONE: ReadonlySet<string> = new Set();

/** Ids of the cut entries a section could be showing: those that came from its adapter. */
export const useCutIds = (section: Section) => {
    const cut = useContext(CutContext);
    const data = useContext(DataContext);
    const adapter = section.adapter ?? data?.adapter;

    return (adapter && cut?.get(adapter)) || NONE;
};
