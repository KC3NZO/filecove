import { MediaFields } from "../src";
import { convert, followingHls, hls, qualitiesWhile } from "./media-uploads";
import { posterTime } from "./poster-time";

import type { FileEntry, MediaForm, MediaProcessFormParams, PropertyDefinition } from "../src";

// What this site's backend can do with assets already uploaded, asked from an asset's view
// (`processForm`), as an app offers what its own backend's pipeline does. They're requests, so
// something can be asked for again with nothing else changed. The media manager only shows the form
// and hands what it holds to the adapter's `process`; the playground's backend
// (`mocks/mock-media.ts`) acts on it. Nothing is offered while an asset is being processed already.

const busy = (asset: FileEntry) => asset.processing?.status === "processing";

const pictureGroups = (asset: FileEntry) => [
    {
        id: "processing",
        title: "What to make",
        properties: [
            { field: "responsive", label: "Make the responsive sizes again", type: "boolean" as const },
            { field: "optimize", label: "Optimize again (strip metadata and compress)", type: "boolean" as const },
            ...(/\.(?:webp|avif)$/i.test(asset.name) ? [] : [convert]),
        ],
    },
];

/**
 * A picture's: its responsive sizes and optimizing again, and another format, for raster pictures
 * only, so an SVG offers nothing; and no other format for pictures already in WebP or AVIF.
 */
export const imageProcessForm = (asset: FileEntry): MediaForm<MediaProcessFormParams> | null =>
    busy(asset) || /\.svg$/i.test(asset.name)
        ? null
        : { render: (form) => <MediaFields {...form} groups={pictureGroups(asset)} /> };

/**
 * A video's fields: streaming as HLS, on or off as it stands, its renditions made again while it has
 * them, in the qualities chosen, all off and empty once HLS is, and the moment its poster is taken from.
 */
const VideoProcessFields = (form: MediaProcessFormParams) => {
    const streaming = !!form.values.hls;
    const remake: PropertyDefinition = {
        field: "remake",
        label: "Make the renditions again",
        type: "boolean",
        disabled: !streaming,
    };

    return (
        <MediaFields
            {...form}
            setValues={(next) => form.setValues(followingHls(next))}
            groups={[
                {
                    id: "streaming",
                    title: "Streaming",
                    properties: [hls, ...(form.asset.meta?.hls ? [remake] : []), qualitiesWhile(streaming)],
                },
                { id: "poster", properties: [posterTime] },
            ]}
        />
    );
};

/** A video's: HLS ticked as it stands, so unticking it is what turns it off, and ticking it what turns it on. */
export const videoProcessForm = (asset: FileEntry): MediaForm<MediaProcessFormParams> | null =>
    busy(asset)
        ? null
        : {
              defaults: asset.meta?.hls ? followingHls({ hls: true }) : { hls: false },
              render: (form) => <VideoProcessFields {...form} />,
          };

const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "fr", label: "Français" },
    { value: "fa", label: "فارسی" },
];

/**
 * A piece of audio's fields: a transcript, made or made again, in a language, which goes when it's
 * unticked and comes back English, and its loudness evened out.
 */
const AudioProcessFields = (form: MediaProcessFormParams) => {
    const { asset, values, setValues } = form;

    return (
        <MediaFields
            {...form}
            setValues={(next) => {
                const { language, ...rest } = next;

                setValues(next.transcribe ? { ...rest, language: language ?? "en" } : rest);
            }}
            groups={[
                {
                    id: "transcript",
                    title: "Transcript",
                    properties: [
                        {
                            field: "transcribe",
                            label: asset.meta?.transcript ? "Transcribe again" : "Transcribe",
                            type: "boolean",
                        },
                        {
                            field: "language",
                            label: "Language",
                            type: "string",
                            disabled: !values.transcribe,
                            options: LANGUAGE_OPTIONS,
                        },
                    ],
                },
                {
                    id: "sound",
                    title: "Sound",
                    properties: [{ field: "normalize", label: "Normalize loudness", type: "boolean" }],
                },
            ]}
        />
    );
};

const audioProcess: MediaForm<MediaProcessFormParams> = { render: (form) => <AudioProcessFields {...form} /> };

/** A piece of audio's: a transcript and its loudness. */
export const audioProcessForm = (asset: FileEntry) => (busy(asset) ? null : audioProcess);
