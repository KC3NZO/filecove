import { useEffect, useRef, useState } from "react";
import { Button, Slider, Text } from "./ui";
import styles from "./poster-time.module.css";

import type { PropertyDefinition, PropertyEditParams } from "../src";

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
        <div className={styles.root}>
            <div className={styles.stage}>
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
            </div>
            <Slider
                aria-labelledby={labelId}
                aria-valuetext={formatTime(at, tenths)}
                min={0}
                max={length ?? 1}
                step={tenths ? 0.1 : 1}
                value={at}
                disabled={disabled || length === undefined}
                onChange={onChange}
            />
            <div className={styles.time}>
                <Text variant="body2" color="secondary">
                    {chosen === undefined
                        ? "The poster in use"
                        : `From ${formatTime(at, tenths)} of ${formatTime(length ?? 0, tenths)}`}
                </Text>
                {chosen !== undefined && (
                    <Button size="small" color="inherit" onClick={() => onChange(undefined)}>
                        Keep the poster in use
                    </Button>
                )}
            </div>
        </div>
    );
};

/** A video's poster, by the moment it's taken from, in seconds, under `posterAt`. */
export const posterTime: PropertyDefinition = {
    field: "posterAt",
    label: "Poster",
    type: "number",
    renderEdit: (params) => <PosterTime {...params} />,
};
