import { useContext } from "react";

import { DataContext } from "../contexts/data-context";
import { DragContext } from "../contexts/drag-context";

import type { Section } from "../types";

const NONE: ReadonlySet<string> = new Set();

/** Ids of the dragged entries a section could be showing: those that came from its adapter. */
export const useDraggedIds = (section: Section) => {
    const dragged = useContext(DragContext)?.dragged;
    const data = useContext(DataContext);
    const adapter = section.adapter ?? data?.adapter;

    return (adapter && dragged?.get(adapter)) || NONE;
};
