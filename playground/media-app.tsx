import { useCallback, useState } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaManager } from "../src";
import { pickFields } from "./media-fields";
import { audioPreviewer, hlsPreviewer } from "./media-previewers";
import { assetProperties, videoProperties } from "./media-properties";
import { siteMediaAdapter, stockMediaAdapter } from "./mocks/mock-media";
import { browse, locale, multiple, single } from "./options";

import type { MediaChoice, MediaSectionGroup } from "../src";

// The media manager's page (`?media`), full-viewport with a footer saying what was last chosen, as
// an editor inserting it would, each pick with what the playground's fields hold for it.

/**
 * The playground's libraries, on two backends: this site's, a root a kind, whose videos are
 * delivered by HLS and so previewed by its own player, and show their renditions, poster and tracks
 * by definitions of their own, and a stock library's, read-only.
 */
const libraries: MediaSectionGroup[] = [
    {
        id: "site",
        title: "This site",
        sections: [
            { id: "images", label: "Images", kind: "image", rootId: "/images" },
            {
                id: "videos",
                label: "Videos",
                kind: "video",
                rootId: "/videos",
                previewers: [hlsPreviewer],
                properties: videoProperties,
            },
            { id: "audio", label: "Audio", kind: "audio", rootId: "/audio" },
            { id: "documents", label: "Documents", kind: "document", rootId: "/documents" },
        ],
    },
    {
        id: "shared",
        title: "Shared",
        sections: [
            {
                id: "stock",
                label: "Stock photos",
                kind: "image",
                icon: "star",
                rootId: "/",
                adapter: stockMediaAdapter,
                readOnly: true,
            },
            // A library whose root refuses to be listed, to see the error.
            { id: "archive", label: "Old archive", kind: "image", icon: "drive", rootId: "/old/archive" },
        ],
    },
];

const previewers = [audioPreviewer];

const appSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
};

const mediaManagerSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    height: "auto",
};

const footerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    minHeight: 40,
    px: 2,
    borderTop: 1,
    borderColor: "divider",
    bgcolor: "background.default",
    color: "text.secondary",
};

/** A pick as an app would store it: its library's id with the asset's, and what's filled in. */
const describeOne = ({ asset, section, values }: MediaChoice) => {
    const filled = Object.entries(values)
        .filter(([, value]) => value !== undefined && value !== "" && value !== false)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

    return `${section.id}:${asset.id}${filled.length > 0 ? ` (${filled.join(", ")})` : ""}`;
};

const describe = (chosen: MediaChoice[] | null) => {
    if (!chosen) {
        return browse ? "Browsing, nothing to choose" : "Nothing chosen yet";
    }

    return `Chosen: ${chosen.map(describeOne).join("; ")}`;
};

const MediaApp = () => {
    const [chosen, setChosen] = useState<MediaChoice[] | null>(null);
    const choose = useCallback((choices: MediaChoice[]) => setChosen(choices), []);
    const shared = {
        adapter: siteMediaAdapter,
        multiple,
        locale,
        onChoose: browse ? undefined : choose,
        fields: pickFields,
        properties: assetProperties,
        previewers,
    };

    return (
        <Box sx={appSx}>
            {single ? (
                <MediaManager {...shared} section={libraries[0].sections[0]} sx={mediaManagerSx} />
            ) : (
                <MediaManager {...shared} sections={libraries} sx={mediaManagerSx} />
            )}
            <Box component="footer" sx={footerSx}>
                <Typography variant="body2" noWrap>
                    {describe(chosen)}
                </Typography>
            </Box>
        </Box>
    );
};

export default MediaApp;
