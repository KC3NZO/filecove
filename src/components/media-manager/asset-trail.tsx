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
