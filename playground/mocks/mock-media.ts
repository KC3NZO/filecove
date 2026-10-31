import { createMockAdapter, file, folder } from "./mock-adapter";
import { shrink, thumbnailSource } from "./mock-content";

import type { EntryProperties, FileAdapter, FileEntry, PropertyValues } from "../../src";
import type { MockNode } from "./mock-adapter";

// The media manager's libraries for the dev host (`?media`): one root a kind, as a site's media
// library would keep them apart, on two backends: this site's, which delivers videos by HLS, and a
// stock library's, read-only. Each hands over its assets' values as plain data; what each asset
// shows of them, and how it plays, are the playground's, as an app's would be.

const PLACES = ["beach", "forest", "harbour", "mountains", "city", "desert", "lake", "meadow", "canyon", "glacier"];
const MOMENTS = ["sunrise", "noon", "sunset", "night"];
const DAY = 86_400_000;

/** A date some days before the playground's today, as ISO. */
const daysAgo = (days: number) => new Date(Date.UTC(2026, 9, 26) - days * DAY).toISOString();

/** Pictures with made-up names and dates, newest first once sorted, spread over a few months. */
const pictures: MockNode[] = Array.from({ length: 36 }, (_, index) => {
    const name = `${PLACES[index % PLACES.length]}-${MOMENTS[index % MOMENTS.length]}-${index + 1}`;
    const extension = ["jpg", "png", "webp", "avif"][index % 4];

    return file(
        `${name}.${extension}`,
        180_000 + ((index * 48_611) % 4_800_000),
        daysAgo(index * 2.7),
        `image/${extension === "jpg" ? "jpeg" : extension}`,
    );
});

const images: MockNode[] = [
    ...pictures,
    file("logo.svg", 3_800, "2026-10-20T09:12", "image/svg+xml"),
    // A format the browser can't draw, which still shows its thumbnail.
    file("print-proof.tiff", 9_400_000, "2026-10-13T16:02", "image/tiff"),
    // Hidden, so it's never shown.
    file(".thumbnails-index", 1_200, "2026-10-26T09:00"),
];

const videos: MockNode[] = [
    file("product-tour.mp4", 48_200_000, "2026-10-22T10:16", "video/mp4"),
    file("intro.webm", 12_700_000, "2026-09-08T19:40", "video/webm"),
    file("customer-story.mov", 230_000_000, "2026-08-14T15:30", "video/quicktime"),
    file("onboarding-part-1.mp4", 88_000_000, "2026-10-18T11:05", "video/mp4"),
    file("onboarding-part-2.mp4", 91_500_000, "2026-10-18T11:40", "video/mp4"),
    file("release-teaser.mp4", 18_300_000, "2026-10-25T17:20", "video/mp4"),
    file("webinar-recording.mp4", 640_000_000, "2026-07-02T14:00", "video/mp4"),
    file("drone-harbour.mov", 152_000_000, "2026-06-11T06:45", "video/quicktime"),
];

const audio: MockNode[] = [
    file("podcast-episode-12.mp3", 41_000_000, "2026-10-01T07:00", "audio/mpeg"),
    file("podcast-episode-11.mp3", 38_600_000, "2026-09-17T07:00", "audio/mpeg"),
    file("podcast-episode-10.mp3", 44_100_000, "2026-09-03T07:00", "audio/mpeg"),
    file("jingle.wav", 5_200_000, "2026-07-19T12:45", "audio/wav"),
    file("product-tour-voiceover.mp3", 6_800_000, "2026-10-21T16:30", "audio/mpeg"),
    file("hold-music.ogg", 3_900_000, "2026-05-28T10:10", "audio/ogg"),
    file("interview-raw.flac", 210_000_000, "2026-08-30T13:15", "audio/flac"),
];

const documents: MockNode[] = [
    file("brand-guidelines.pdf", 2_400_000, "2026-06-30T12:00", "application/pdf"),
    file("price-list.pdf", 310_000, "2026-10-02T08:20", "application/pdf"),
    file("annual-report-2025.pdf", 8_900_000, "2026-03-14T09:00", "application/pdf"),
    file("press-kit.pdf", 4_100_000, "2026-09-22T15:45", "application/pdf"),
    file("terms-of-service.pdf", 190_000, "2026-01-05T10:00", "application/pdf"),
    file("media-plan.xlsx", 64_000, "2026-10-10T14:30"),
];

const stock: MockNode[] = Array.from({ length: 18 }, (_, index) =>
    file(
        `stock-${PLACES[(index * 3) % PLACES.length]}-${String(index + 1).padStart(2, "0")}.jpg`,
        900_000 + ((index * 77_773) % 6_000_000),
        new Date(Date.UTC(2025, 11, 1) - index * 9 * DAY).toISOString(),
        "image/jpeg",
    ),
);

const siteAdapter = createMockAdapter(
    {
        "/images": images,
        "/videos": videos,
        "/audio": audio,
        "/documents": documents,
        // A library whose root refuses to be listed, to see the error.
        "/old": [{ ...folder("archive", "2020-01-01T00:00", []), fails: true }],
    },
    { latency: [300, 900] },
);

const stockAdapter = createMockAdapter({ "/": stock }, { latency: [500, 1200] });

const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, ms);

        signal.addEventListener(
            "abort",
            () => {
                window.clearTimeout(timer);
                reject(signal.reason);
            },
            { once: true },
        );
    });

/** A number made up from a name, the same every time. */
const hashOf = (name: string) => [...name].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7);

const frameUrls = new Map<string, string>();

/**
 * The made-up picture of a file of that name, as a URL kept for the page's life, as a backend's
 * poster frames would be; a picture's own name gives the picture the image library shows.
 */
const frameUrl = (name: string) => {
    let url = frameUrls.get(name);

    if (!url) {
        url = URL.createObjectURL(thumbnailSource(name, "image/jpeg") as Blob);
        frameUrls.set(name, url);
    }

    return url;
};

const isVideo = (entry: FileEntry) => entry.mimeType?.startsWith("video/") ?? false;
const isAudio = (entry: FileEntry) => entry.mimeType?.startsWith("audio/") ?? false;
const isImage = (entry: FileEntry) => entry.mimeType?.startsWith("image/") ?? false;

/** How many poster frames a video has, and which one is in use, as its backend chose. */
const framesOf = (entry: FileEntry) => {
    const hash = hashOf(entry.name);
    const count = 3 + (hash % 3);

    return { count, current: hash % count };
};

/** The name of a video's poster frame's made-up picture. */
const frameName = (entry: FileEntry, index: number) => `${entry.name.replace(/\.\w+$/, "")}-${index}.jpg`;

const PICTURE_SIZES = [
    { width: 1920, height: 1080 },
    { width: 1080, height: 1350 },
    { width: 2048, height: 2048 },
    { width: 4000, height: 3000 },
];

const VIDEO_SIZES = [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
    { width: 1280, height: 720 },
];

/** What a listing says of an asset, made up from its name: a picture's size, a video's or a sound's length. */
const mediaOf = (entry: FileEntry): FileEntry["media"] => {
    const hash = hashOf(entry.name);

    if (entry.name === "logo.svg") {
        return { width: 512, height: 512 };
    }

    if (isImage(entry)) {
        return PICTURE_SIZES[hash % PICTURE_SIZES.length];
    }

    if (isVideo(entry)) {
        return { ...VIDEO_SIZES[hash % VIDEO_SIZES.length], duration: 30 + (hash % 1800) };
    }

    if (isAudio(entry)) {
        return { duration: 60 + (hash % 3600) };
    }

    return undefined;
};

/**
 * What this backend delivers a video by, which the media manager carries in `meta` without reading
 * it, for the playground's own player and for the app once it's chosen: an HLS manifest, as a
 * transcoding backend hands over, and the poster in use. `sample` is the playground's alone, the
 * MDN clip its stand-in player plays, as there's no HLS server behind the mock.
 */
const metaOf = (entry: FileEntry): FileEntry["meta"] =>
    isVideo(entry)
        ? {
              hls: `https://cdn.example.com/media${entry.id.replace(/\.\w+$/, "")}/master.m3u8`,
              poster: frameUrl(frameName(entry, framesOf(entry).current)),
              sample: "https://mdn.github.io/shared-assets/videos/flower.mp4",
          }
        : undefined;

const RENDITIONS = ["2160p", "1080p", "720p", "480p", "360p"];
const LANGUAGE_NAMES = ["English", "Français", "Deutsch", "Español"];

/** A job of this backend's making a rendition: done, under way with how far along, waiting, or failed. */
export interface RenditionJob {
    name: string;
    status: "done" | "processing" | "queued" | "failed";
    /** From 0 to 1, while it's under way. */
    progress?: number;
    error?: string;
}

/** An audio track or subtitles of a video, as this backend lists them. */
export interface Track {
    language: string;
    default?: boolean;
    forced?: boolean;
}

/** A video's poster: the frames to choose from, and the one in use. */
export interface PosterChoice {
    frames: string[];
    current: number;
}

// The video still being transcoded, its renditions made one after another from when the page loaded.
const PROCESSING = "release-teaser.mp4";
const STARTED = Date.now();
const SECONDS_EACH = 12;

/** A video's renditions, as this backend's jobs stand right now. */
const renditionJobs = (entry: FileEntry): RenditionJob[] => {
    const height = mediaOf(entry)?.height ?? 1080;
    const names = RENDITIONS.filter((each) => Number.parseInt(each) <= height);

    if (entry.name === PROCESSING) {
        const elapsed = (Date.now() - STARTED) / 1000;

        return names.map((name, index) => {
            const progress = (elapsed - index * SECONDS_EACH) / SECONDS_EACH;

            return progress >= 1
                ? { name, status: "done" }
                : progress > 0
                  ? { name, status: "processing", progress }
                  : { name, status: "queued" };
        });
    }

    // One video in five has a rendition that failed.
    return names.map((name, index) =>
        hashOf(entry.name) % 5 === 0 && index === names.length - 1
            ? { name, status: "failed", error: "The encoder ran out of memory." }
            : { name, status: "done" },
    );
};

/**
 * Asks this backend how a video's renditions stand, as a renderer of the app's would poll its API
 * (or listen to its socket) to show them live.
 */
export const pollRenditions = (entry: FileEntry): Promise<RenditionJob[]> =>
    new Promise((resolve) => window.setTimeout(() => resolve(renditionJobs(entry)), 150));

/** The format a file is in, as this backend names it. */
const formatOf = (entry: FileEntry) => entry.name.split(".").pop()?.toUpperCase() ?? "";

/** What's saved of an asset's editable properties, by adapter and id, as a backend keeps it. */
const savedValues = new Map<string, PropertyValues>();

/** A day some months before the playground's today, made up from a name, as ISO: "2026-05-14". */
const dayOf = (hash: number) => new Date(Date.UTC(2026, 4, 1) - (hash % 400) * DAY).toISOString().slice(0, 10);

/**
 * An asset's values, as this backend keeps them, by its own keys: what a file is like, what was
 * written about it, how a video is delivered, and what's saved over them. Plain data, as JSON
 * would bring it; the playground's definitions decide what's shown of it, and how.
 */
const propertiesOf = (entry: FileEntry, key: string, stock: boolean): EntryProperties => {
    const hash = hashOf(entry.name);
    const values: PropertyValues = { format: formatOf(entry), tags: [] };

    if (isImage(entry)) {
        Object.assign(values, {
            alt: "",
            caption: "",
            takenOn: dayOf(hash),
            usage: stock ? "licensed" : hash % 3 === 0 ? "editorial" : "owned",
            commercial: stock || hash % 2 === 0,
            credit: stock ? "Northwind Stock" : "",
        });
    } else if (isVideo(entry)) {
        const { count, current } = framesOf(entry);

        Object.assign(values, {
            poster: {
                frames: Array.from({ length: count }, (_, index) => frameUrl(frameName(entry, index))),
                current,
            } satisfies PosterChoice,
            renditions: renditionJobs(entry),
            audioTracks: LANGUAGE_NAMES.slice(0, 1 + (hash % 3)).map(
                (language, index): Track => ({ language, default: index === 0 }),
            ),
            subtitles: LANGUAGE_NAMES.slice(0, hash % 4).map(
                (language, index): Track => ({ language, forced: index === 1 && hash % 2 === 0 }),
            ),
            manifest: String(entry.meta?.hls ?? ""),
            caption: "",
        });
    } else if (isAudio(entry)) {
        values.bitrate = [128, 192, 256, 320][hash % 4];
    } else {
        values.pages = 2 + (hash % 60);
    }

    return { values: { ...values, ...savedValues.get(key) } };
};

/**
 * Makes an adapter of the mock a media backend: what its listings say of each asset (`media`, and
 * a video's delivery in `meta`), a video's poster frame in use as its thumbnail, and its properties,
 * with what's saved of them kept here.
 */
const withMedia = (adapter: FileAdapter, readOnly = false): FileAdapter => ({
    ...adapter,
    list: (folderId, options) =>
        adapter.list(folderId, options).then((result) => ({
            ...result,
            entries: result.entries.map((entry) =>
                entry.kind === "file" ? { ...entry, media: mediaOf(entry), meta: metaOf(entry) } : entry,
            ),
        })),
    thumbnail: (entry, options) =>
        isVideo(entry)
            ? wait(200 + (hashOf(entry.name) % 400), options.signal)
                  .then(() => shrink(thumbnailSource(frameName(entry, framesOf(entry).current)) as Blob, options.size))
                  .then((blob) => blob && { blob })
            : (adapter.thumbnail?.(entry, options) ?? Promise.resolve(null)),
    properties: (entry, { signal }) =>
        wait(250 + (hashOf(entry.name) % 500), signal).then(() =>
            propertiesOf(entry, `${readOnly}:${entry.id}`, readOnly),
        ),
    // Saves what's changed with the asset, refusing any value with "fail" in it, to see a save fail.
    updateProperties: (entry, values, { signal }) =>
        wait(400, signal).then(() => {
            const refused = Object.values(values)
                .flat()
                .find((value) => typeof value === "string" && /fail/i.test(value));

            if (refused !== undefined) {
                throw new Error(`The server refused “${refused}”.`);
            }

            const key = `${readOnly}:${entry.id}`;

            savedValues.set(key, { ...savedValues.get(key), ...values });
        }),
});

/** This site's backend: images, videos (delivered by HLS), audio and documents, a root a kind. */
export const siteMediaAdapter = withMedia(siteAdapter);

/** A stock library's backend, another one, read-only. */
export const stockMediaAdapter = withMedia(stockAdapter, true);
