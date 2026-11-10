import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { joinIsolated } from "../../utils/bidi";

import type { FolderRef } from "../../types";

interface AssetTrailProps {
    /** The groups between the level searched and what's found, outermost first. */
    trail: readonly FolderRef[];
}

const trailSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

// Only taken while the grid shows results with trails (`data-trails`), so those without one are as tall.
const roomSx: SxProps<Theme> = {
    ...trailSx,
    display: "none",
    "[data-trails='true'] &": { display: "block" },
};

/** Where a search's result is below the level searched, one line under what else its look says. */
const AssetTrail = ({ trail }: AssetTrailProps) => {
    const { text } = useLocale();
    const place = text.mediaInGroup(
        joinIsolated(
            trail.map(({ name }) => name),
            " / ",
        ),
    );

    return (
        <Typography variant="caption" noWrap data-status="trail" title={place} sx={trailSx}>
            {place}
        </Typography>
    );
};

export default AssetTrail;

/**
 * The room a trail takes, empty, under what an asset found right in the level searched shows, while
 * the grid shows results from further down too, as every asset in it is laid out as tall.
 */
export const TrailRoom = () => (
    <Typography variant="caption" aria-hidden sx={roomSx}>
        {"\u00a0"}
    </Typography>
);
