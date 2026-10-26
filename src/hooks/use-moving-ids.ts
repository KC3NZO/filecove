import { useContext } from "react";

import { DataContext } from "../contexts/data-context";
import { MovingContext } from "../contexts/moving-context";
import { movingThrough } from "../utils/transfer";

import type { Section } from "../types";

/** Ids of the entries held that a section could be showing, those its adapter serves, with what holds each. */
export const useMovingIds = (section: Section) => {
    const moving = useContext(MovingContext);
    const data = useContext(DataContext);

    return movingThrough(moving, section.adapter ?? data?.adapter);
};
