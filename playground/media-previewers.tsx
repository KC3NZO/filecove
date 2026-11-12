import { Chip } from "./ui";
import styles from "./media-previewers.module.css";

import type { FilePreviewer } from "../src";

/**
 * This site's videos, delivered by HLS: an app would hand `meta.hls` to hls.js or Shaka. The mock
 * has no HLS server, so this stand-in plays MDN's sample clip under the video's own poster, and
 * says which manifest it stands in for.
 */
export const hlsPreviewer: FilePreviewer = {
    id: "hls",
    reads: "none",
    accepts: (entry) => typeof entry.meta?.hls === "string",
    render: ({ entry }) => (
        <div className={styles.player}>
            <video
                key={entry.id}
                controls
                playsInline
                preload="metadata"
                poster={entry.meta?.poster as string | undefined}
                src={entry.meta?.sample as string | undefined}
            />
            <Chip label="HLS stand-in" title={entry.meta?.hls as string} className={styles.badge} />
        </div>
    ),
};

/** Sound in any library, from the adapter's `content`, which the browser plays. */
export const audioPreviewer: FilePreviewer = {
    id: "audio",
    accepts: (entry) => entry.mimeType?.startsWith("audio/") ?? false,
    render: ({ content }) => <audio controls src={content?.url} className={styles.audio} />,
};
