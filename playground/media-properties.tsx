import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { PropertyDisplay } from "../src";
import { posterField, teaserField } from "./media-relation";
import { pollRenditions } from "./mocks/mock-media";

import type {
    FileEntry,
    MediaKind,
    MediaSection,
    PropertyDefinition,
    PropertyDefinitionGroup,
    PropertyRenderParams,
} from "../src";
import type { PosterChoice, RenditionJob, Track } from "./mocks/mock-media";

// What the playground's assets show as one is opened, as an app would define it: the values its
// backend hands over, each shown as a type of the media manager's, a little changed by a formatter,
// or drawn entirely the playground's own way. The media manager only lays them out.

const formatSx: SxProps<Theme> = {
    display: "inline-flex",
    alignItems: "center",
    gap: 1,
};

const listSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    m: 0,
    p: 0,
    listStyle: "none",
};

const jobSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
};

const jobHeadSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 1,
    fontSize: "0.875rem",
};

const statusSx: SxProps<Theme> = {
    fontSize: "0.75rem",
    fontWeight: 600,
    '&[data-status="done"]': { color: "success.main" },
    '&[data-status="processing"]': { color: "primary.main" },
    '&[data-status="queued"]': { color: "text.secondary" },
    '&[data-status="failed"]': { color: "error.main" },
};

const barSx: SxProps<Theme> = {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    bgcolor: "action.selected",
    "& > div": { height: "100%", bgcolor: "primary.main", transition: "width 0.3s" },
};

const errorSx: SxProps<Theme> = {
    color: "error.main",
    fontSize: "0.75rem",
};

const trackSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    fontSize: "0.875rem",
};

const framesSx: SxProps<Theme> = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 0.75,
};

const frameSx: SxProps<Theme> = {
    aspectRatio: "16 / 9",
    borderRadius: 1,
    overflow: "hidden",
    outline: "2px solid transparent",
    outlineOffset: 1,
    "& > img": { width: "100%", height: "100%", objectFit: "cover" },
    "&[aria-checked='true']": { outlineColor: (theme) => theme.palette.primary.main },
    "&.Mui-focusVisible": { outlineColor: (theme) => theme.palette.text.primary },
};

const statusText = (job: RenditionJob) => {
    switch (job.status) {
        case "done":
            return "Done";
        case "processing":
            return `${Math.round((job.progress ?? 0) * 100)}%`;
        case "queued":
            return "Waiting";
        case "failed":
            return "Failed";
    }
};

/**
 * A video's renditions as its backend's jobs stand: done, waiting, failed with why, or under way
 * with how far along. While any is unfinished it asks the backend again every second, as an app
 * would poll its API or listen to its socket, so it stays live with nothing of the media manager's.
 */
const JobList = ({ value, entry }: PropertyRenderParams) => {
    const [polled, setPolled] = useState<RenditionJob[] | null>(null);
    const jobs = polled ?? ((value as RenditionJob[] | undefined) ?? []);
    const unfinished = jobs.some((job) => job.status === "processing" || job.status === "queued");

    useEffect(() => {
        if (!unfinished) {
            return;
        }

        let stopped = false;
        const timer = window.setInterval(() => {
            pollRenditions(entry).then((next) => {
                if (!stopped) {
                    setPolled(next);
                }
            });
        }, 1000);

        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [entry, unfinished]);

    return (
        <Box component="ul" sx={listSx}>
            {jobs.map((job) => {
                const percent = Math.round((job.progress ?? 0) * 100);

                return (
                    <Box component="li" key={job.name} sx={jobSx}>
                        <Box sx={jobHeadSx}>
                            <span>{job.name}</span>
                            <Box component="span" data-status={job.status} sx={statusSx}>
                                {statusText(job)}
                            </Box>
                        </Box>
                        {job.status === "processing" && (
                            <Box
                                role="progressbar"
                                aria-label={job.name}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={percent}
                                sx={barSx}
                            >
                                <div style={{ width: `${percent}%` }} />
                            </Box>
                        )}
                        {job.status === "failed" && job.error && <Typography sx={errorSx}>{job.error}</Typography>}
                    </Box>
                );
            })}
        </Box>
    );
};

/** A video's audio tracks or subtitles, each with the backend's marks: the default, the forced. */
const TrackList = ({ value }: PropertyRenderParams) => {
    const tracks = (value as Track[] | undefined) ?? [];

    return (
        <Box component="ul" sx={listSx}>
            {tracks.map((track) => (
                <Box component="li" key={track.language} sx={trackSx}>
                    <span>{track.language}</span>
                    {track.default && <Chip size="small" label="Default" />}
                    {track.forced && <Chip size="small" variant="outlined" label="Forced" />}
                </Box>
            ))}
        </Box>
    );
};

/**
 * A video's poster frames, the one in use ringed; picking another saves it through the media
 * manager's `save`, which a read-only library doesn't offer.
 */
const PosterPicker = ({ value, labelId, save, saving }: PropertyRenderParams) => {
    const poster = value as PosterChoice | undefined;

    if (!poster) {
        return null;
    }

    return (
        <Box role="radiogroup" aria-labelledby={labelId} sx={framesSx}>
            {poster.frames.map((url, index) => (
                <ButtonBase
                    key={url}
                    role="radio"
                    aria-checked={index === poster.current}
                    aria-label={`Frame ${index + 1}`}
                    disabled={!save || saving}
                    sx={frameSx}
                    onClick={() => save?.({ ...poster, current: index })}
                >
                    <img src={url} alt="" draggable={false} />
                </ButtonBase>
            ))}
        </Box>
    );
};

// What every kind of file shows, from its entry or from what the backend hands over.

const dimensions: PropertyDefinition = {
    field: "dimensions",
    label: "Dimensions",
    type: "string",
    valueGetter: (_, asset) =>
        asset.media?.width !== undefined && asset.media.height !== undefined
            ? `${asset.media.width} × ${asset.media.height}`
            : undefined,
};

const length: PropertyDefinition = {
    field: "duration",
    label: "Length",
    type: "number",
    kind: "duration",
    valueGetter: (_, asset) => asset.media?.duration,
};

// Shown as any text is, with a mark of the app's own beside those browsers show as they are.
const format: PropertyDefinition = {
    field: "format",
    label: "Format",
    type: "string",
    render: (params) => (
        <Box component="span" sx={formatSx}>
            <PropertyDisplay {...params} />
            {/\b(?:webp|avif|mp4|webm)\b/i.test(params.formattedValue) && <Chip size="small" label="Web-ready" />}
        </Box>
    ),
};

const size: PropertyDefinition = {
    field: "size",
    label: "Size",
    type: "number",
    kind: "size",
    valueGetter: (_, asset) => asset.size,
};

const added: PropertyDefinition = {
    field: "added",
    label: "Added",
    type: "date",
    kind: "datetime",
    valueGetter: (_, asset) => asset.modifiedAt,
};

// Typed, so its formatter has a number: a video's height, as people name it.
const quality: PropertyDefinition<number> = {
    field: "quality",
    label: "Quality",
    type: "number",
    valueGetter: (_, asset) => asset.media?.height,
    valueFormatter: (height) => (height >= 2160 ? "4K" : height >= 1080 ? "Full HD" : height >= 720 ? "HD" : "SD"),
};

const bitrate: PropertyDefinition<number> = {
    field: "bitrate",
    label: "Bit rate",
    type: "number",
    valueFormatter: (kbps) => `${kbps} kbps`,
};

// The asset's name, as this backend sees it: one more thing about the asset, not a file to rename,
// saved with `updateProperties` as the caption is. A library that shouldn't have it just leaves it out.
const naming: PropertyDefinitionGroup = {
    id: "name",
    properties: [{ field: "name", label: "Name", type: "string", editable: true }],
};

const caption: PropertyDefinition = {
    field: "caption",
    label: "Caption",
    type: "string",
    editable: true,
    multiline: true,
};

// Typed in freely, as tags are.
const labels: PropertyDefinitionGroup = {
    id: "labels",
    properties: [{ field: "tags", label: "Tags", type: "string", multiple: true, editable: true }],
};

const imageProperties: PropertyDefinitionGroup[] = [
    {
        id: "picture",
        properties: [dimensions, format, size, added, { field: "takenOn", label: "Taken", type: "date" }],
    },
    {
        id: "description",
        title: "Description",
        properties: [
            { field: "alt", label: "Alt text", type: "string", editable: true, maxLength: 250 },
            caption,
        ],
    },
    {
        id: "rights",
        title: "Rights",
        properties: [
            {
                field: "usage",
                label: "Usage",
                type: "string",
                editable: true,
                options: [
                    { value: "owned", label: "Our own" },
                    { value: "licensed", label: "Licensed" },
                    { value: "editorial", label: "Editorial use only" },
                ],
            },
            { field: "commercial", label: "Commercial use", type: "boolean", editable: true },
            { field: "credit", label: "Credit", type: "string", editable: true, placeholder: "Who to credit" },
        ],
    },
    labels,
];

/**
 * This site's videos, as only its backend hands them over: the poster in use picked among its
 * frames, renditions as its jobs stand, tracks and the manifest it delivers them by, and tags
 * chosen from the site's own.
 */
export const videoProperties: PropertyDefinitionGroup[] = [
    naming,
    { id: "video", properties: [dimensions, quality, length, format, size, added] },
    {
        id: "delivery",
        title: "Delivery",
        properties: [
            { field: "poster", label: "Poster", editable: true, render: (params) => <PosterPicker {...params} /> },
            { field: "renditions", label: "Renditions", render: (params) => <JobList {...params} /> },
            { field: "audioTracks", label: "Audio tracks", render: (params) => <TrackList {...params} /> },
            { field: "subtitles", label: "Subtitles", render: (params) => <TrackList {...params} /> },
            { field: "manifest", label: "Manifest", type: "string", kind: "url", copyable: true },
        ],
    },
    { id: "description", title: "Description", properties: [caption] },
    {
        id: "labels",
        properties: [
            {
                field: "tags",
                label: "Tags",
                type: "string",
                multiple: true,
                editable: true,
                options: [
                    { value: "hero", label: "Hero" },
                    { value: "promo", label: "Promo" },
                    { value: "tutorial", label: "Tutorial" },
                    { value: "social", label: "Social" },
                ],
            },
        ],
    },
];

const BY_KIND: Record<MediaKind, PropertyDefinitionGroup[]> = {
    image: imageProperties,
    // A video of a library without its own, which knows nothing of its delivery.
    video: [{ id: "video", properties: [dimensions, quality, length, format, size, added] }, labels],
    audio: [
        { id: "audio", properties: [length, bitrate, format, size, added] },
        { id: "transcript", properties: [{ field: "transcript", label: "Transcript", type: "string" }] },
        labels,
    ],
    document: [
        { id: "document", properties: [{ field: "pages", label: "Pages", type: "number" }, format, size, added] },
        labels,
    ],
};

// The same with its name to change, where its library can change anything.
const NAMED_BY_KIND: Record<MediaKind, PropertyDefinitionGroup[]> = {
    image: [naming, ...BY_KIND.image],
    video: [naming, ...BY_KIND.video],
    audio: [naming, ...BY_KIND.audio],
    document: [naming, ...BY_KIND.document],
};

// What this backend calls its groups, chosen once one's made, as it's made with only a name.
const GROUP_TYPES = ["Series", "Season", "Collection", "Album"].map((type) => ({ value: type, label: type }));

// What a group shows, whichever kind its library holds: this backend's own words for it, and what's
// written about it. The media manager knows nothing of these.
const groupProperties: PropertyDefinitionGroup[] = [
    naming,
    {
        id: "about",
        properties: [
            { field: "type", label: "Type", type: "string", options: GROUP_TYPES, editable: true },
            { field: "description", label: "Description", type: "string", multiline: true, editable: true },
            { field: "released", label: "Released", type: "date", editable: false },
            teaserField,
            posterField,
        ],
    },
];

/** What an asset or a group shows in a library without definitions of its own, by its kind. */
export const assetProperties = (entry: FileEntry, section: MediaSection) =>
    entry.kind === "folder" ? groupProperties : (section.readOnly ? BY_KIND : NAMED_BY_KIND)[section.kind];

/** What Videos' assets and groups show, as that library defines its own. */
export const videoEntryProperties = (entry: FileEntry) =>
    entry.kind === "folder" ? groupProperties : videoProperties;
