import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { SxProps, Theme } from "@mui/material/styles";

import type { FilePreviewer } from "../src";

// The playground's previewers for the media manager, as an app's would be: the media manager plays
// nothing itself. One belongs to a library, as its backend delivers it; one is for every library.

const playerSx: SxProps<Theme> = {
    position: "relative",
    width: "100%",
    height: "100%",
    bgcolor: "common.black",
    "& > video": { display: "block", width: "100%", height: "100%", objectFit: "contain" },
};

const badgeSx: SxProps<Theme> = {
    position: "absolute",
    top: 8,
    insetInlineStart: 8,
    bgcolor: "rgb(0 0 0 / 0.6)",
    color: "common.white",
};

const audioSx: SxProps<Theme> = {
    width: "min(100% - 2rem, 28rem)",
};

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
        <Box sx={playerSx}>
            <video
                key={entry.id}
                controls
                playsInline
                preload="metadata"
                poster={entry.meta?.poster as string | undefined}
                src={entry.meta?.sample as string | undefined}
            />
            <Chip size="small" label="HLS stand-in" title={entry.meta?.hls as string} sx={badgeSx} />
        </Box>
    ),
};

/** Sound in any library, from the adapter's `content`, which the browser plays. */
export const audioPreviewer: FilePreviewer = {
    id: "audio",
    accepts: (entry) => entry.mimeType?.startsWith("audio/") ?? false,
    render: ({ content }) => <Box component="audio" controls src={content?.url} sx={audioSx} />,
};
