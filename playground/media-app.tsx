import { useCallback, useState } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaManager } from "../src";
import { pickFields } from "./media-fields";
import { audioPreviewer, hlsPreviewer } from "./media-previewers";
import { assetProperties, videoProperties } from "./media-properties";
import { siteMediaAdapter, stockMediaAdapter } from "./mocks/mock-media";
import { savePicks } from "./mocks/mock-save";
import { browse, locale, multiple, single } from "./options";

import type { FieldErrors, MediaChoice, MediaSectionGroup } from "../src";

// The media manager's page (`?media`), full-viewport with a footer saying what was last chosen, as
// an editor inserting it would, each pick with what the playground's fields hold for it. Choose
// saves the picks to the playground's backend first, which may answer with errors, as Laravel's
// validation does, handed back to the media manager as they came.

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

/** Where saving the picks is at. */
type Saving = { status: "idle" } | { status: "saving" } | { status: "refused"; count: number };

const describe = (chosen: MediaChoice[] | null, saving: Saving) => {
    if (saving.status === "saving") {
        return "Saving…";
    }

    if (saving.status === "refused") {
        return `The backend refused it: ${saving.count === 1 ? "1 error" : `${saving.count} errors`} to fix`;
    }

    if (!chosen) {
        return browse ? "Browsing, nothing to choose" : "Nothing chosen yet";
    }

    return `Chosen: ${chosen.map(describeOne).join("; ")}`;
};

const MediaApp = () => {
    const [chosen, setChosen] = useState<MediaChoice[] | null>(null);
    const [errors, setErrors] = useState<FieldErrors>();
    const [saving, setSaving] = useState<Saving>({ status: "idle" });

    // Saved first, as an app would save a product's carousel: what the backend refuses goes back to
    // the media manager, and what it takes is chosen.
    const choose = useCallback((choices: MediaChoice[]) => {
        setSaving({ status: "saving" });
        void savePicks(choices).then((answered) => {
            setErrors(answered ?? undefined);

            if (answered) {
                setSaving({ status: "refused", count: Object.keys(answered).length });
            } else {
                setSaving({ status: "idle" });
                setChosen(choices);
            }
        });
    }, []);
    const shared = {
        adapter: siteMediaAdapter,
        multiple,
        locale,
        onChoose: browse ? undefined : choose,
        fields: pickFields,
        properties: assetProperties,
        previewers,
        errors,
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
                    {describe(chosen, saving)}
                </Typography>
            </Box>
        </Box>
    );
};

export default MediaApp;
