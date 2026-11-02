import { useEffect, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import type { PropertyDefinition, PropertyEditParams } from "../src";

// A field of the playground's own, as an app would draw one: the media manager only lays it out and
// hands what it holds to the adapter's `process`, and what's made of it is the backend's.

const rootSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
};

const stageSx: SxProps<Theme> = {
    position: "relative",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    borderRadius: 1,
    bgcolor: "common.black",
    "& > video, & > img": {
        position: "absolute",
        inset: 0,
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
    },
};

// The time runs from the start on the left, as a video's does, whichever way the page reads.
const timeSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    minHeight: 32,
    fontVariantNumeric: "tabular-nums",
};

/** A moment of a video, as "1:05", with tenths for a short one, whose frames are that close. */
const formatTime = (seconds: number, tenths: boolean) => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    const shown = tenths ? rest.toFixed(1).padStart(4, "0") : String(Math.floor(rest)).padStart(2, "0");

    return `${minutes}:${shown}`;
};

/**
 * Where a video's poster is taken from: the video itself, moved to the moment with a slider, under
 * the poster in use until it's moved. Holds the time in seconds, or nothing, which leaves the poster
 * as it is. The slider's length is the video's own once it's loaded, or what the listing says of it
 * when it can't be, which can still be asked for, unseen.
 */
const PosterTime = ({ value, entry, adapter, labelId, onChange, disabled }: PropertyEditParams) => {
    const chosen = value as number | undefined;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [source, setSource] = useState<string>();
    const [length, setLength] = useState<number>();

    useEffect(() => {
        const controller = new AbortController();
        let objectUrl: string | undefined;

        Promise.resolve(adapter.content?.(entry, { signal: controller.signal, purpose: "preview", onProgress: () => {} })).then(
            (content) => {
                if (controller.signal.aborted) {
                    return;
                }

                if (content?.blob) {
                    objectUrl = URL.createObjectURL(content.blob);
                }

                setSource(objectUrl ?? content?.url);
                setLength(content ? undefined : entry.media?.duration);
            },
            () => {
                if (!controller.signal.aborted) {
                    setLength(entry.media?.duration);
                }
            },
        );

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
        // By its id, as it's a new object each time its backend's work moves on.
    }, [adapter, entry.id]);

    const inUse = typeof entry.meta?.posterAt === "number" ? entry.meta.posterAt : 0;
    const at = Math.min(chosen ?? inUse, length ?? Infinity);
    const poster = typeof entry.meta?.poster === "string" ? entry.meta.poster : undefined;
    const tenths = (length ?? 0) < 60;

    useEffect(() => {
        const video = videoRef.current;

        if (video && length !== undefined && Math.abs(video.currentTime - at) > 0.01) {
            video.currentTime = at;
        }
    }, [at, length]);

    return (
        <Box sx={rootSx}>
            <Box sx={stageSx}>
                {source && (
                    <video
                        ref={videoRef}
                        src={source}
                        muted
                        playsInline
                        preload="auto"
                        onLoadedMetadata={(event) => setLength(event.currentTarget.duration)}
                        onError={() => setLength(entry.media?.duration)}
                    />
                )}
                {chosen === undefined && poster && <img src={poster} alt="" draggable={false} />}
            </Box>
            <Slider
                size="small"
                aria-labelledby={labelId}
                aria-valuetext={formatTime(at, tenths)}
                min={0}
                max={length ?? 1}
                step={tenths ? 0.1 : 1}
                value={at}
                disabled={disabled || length === undefined}
                onChange={(_, next) => onChange(next as number)}
            />
            <Box sx={timeSx}>
                <Typography variant="body2" color="text.secondary">
                    {chosen === undefined
                        ? "The poster in use"
                        : `From ${formatTime(at, tenths)} of ${formatTime(length ?? 0, tenths)}`}
                </Typography>
                {chosen !== undefined && (
                    <Button size="small" color="inherit" onClick={() => onChange(undefined)}>
                        Keep the poster in use
                    </Button>
                )}
            </Box>
        </Box>
    );
};

/** A video's poster, by the moment it's taken from, in seconds, under `posterAt`. */
export const posterTime: PropertyDefinition = {
    field: "posterAt",
    label: "Poster",
    type: "number",
    renderEdit: (params) => <PosterTime {...params} />,
};
