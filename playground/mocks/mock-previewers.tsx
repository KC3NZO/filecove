import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import FolderOutlined from "@mui/icons-material/FolderOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import type { FileEntry, FilePreviewer, PreviewerProps } from "../../src";

// Previewers of the playground's own, as an app would plug them in: Markdown rendered, CSV as a
// table and what's in a zip, each small and written here, with no library, as an app might use one.

/** A block of a Markdown document, as the little renderer below reads it. */
type Block =
    | { kind: "heading"; level: number; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "list"; ordered: boolean; items: string[] }
    | { kind: "quote"; text: string }
    | { kind: "code"; text: string };

/** A file or folder listed in a zip's central directory. */
interface ZipEntry {
    path: string;
    size: number;
    modified: Date;
    folder: boolean;
}

/** How many rows of a CSV file the table shows. */
const MAX_ROWS = 1000;

const extensionOf = ({ name }: FileEntry) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

const BULLET = /^\s*[-*+]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const FENCE = /^```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const QUOTE = /^>\s?/;
// What starts a block other than a paragraph, which ends the paragraph before it.
const BLOCK_START = /^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s)/;
// Code, bold, italics and links, in that order, within a line.
const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

const parseMarkdown = (source: string) => {
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    const blocks: Block[] = [];
    let at = 0;

    while (at < lines.length) {
        const line = lines[at];
        const heading = HEADING.exec(line);

        if (FENCE.test(line)) {
            const body: string[] = [];

            for (at += 1; at < lines.length && !FENCE.test(lines[at]); at += 1) {
                body.push(lines[at]);
            }

            blocks.push({ kind: "code", text: body.join("\n") });
            at += 1;
        } else if (heading) {
            blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
            at += 1;
        } else if (BULLET.test(line) || NUMBERED.test(line)) {
            const marker = NUMBERED.test(line) ? NUMBERED : BULLET;
            const items: string[] = [];

            for (; at < lines.length && marker.test(lines[at]); at += 1) {
                items.push(lines[at].replace(marker, ""));
            }

            blocks.push({ kind: "list", ordered: marker === NUMBERED, items });
        } else if (QUOTE.test(line)) {
            const body: string[] = [];

            for (; at < lines.length && QUOTE.test(lines[at]); at += 1) {
                body.push(lines[at].replace(QUOTE, ""));
            }

            blocks.push({ kind: "quote", text: body.join(" ") });
        } else if (!line.trim()) {
            at += 1;
        } else {
            const body = [line];

            for (at += 1; at < lines.length && lines[at].trim() && !BLOCK_START.test(lines[at]); at += 1) {
                body.push(lines[at]);
            }

            blocks.push({ kind: "paragraph", text: body.join(" ") });
        }
    }

    return blocks;
};

const SAFE_LINK = /^(https?:|mailto:)/i;

/** A line's code, bold, italics and links as elements, the rest as text. */
const inline = (text: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    let last = 0;

    for (const match of text.matchAll(INLINE)) {
        const [token] = match;
        const start = match.index;

        parts.push(text.slice(last, start));

        if (match[1]) {
            parts.push(<code key={start}>{token.slice(1, -1)}</code>);
        } else if (match[2]) {
            parts.push(<strong key={start}>{token.slice(2, -2)}</strong>);
        } else if (match[3]) {
            parts.push(<em key={start}>{token.slice(1, -1)}</em>);
        } else {
            const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token) ?? [];

            parts.push(
                href && SAFE_LINK.test(href) ? (
                    <Link key={start} href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                    </Link>
                ) : (
                    label
                ),
            );
        }

        last = start + token.length;
    }

    parts.push(text.slice(last));

    return parts;
};

// Each block runs the way its own letters do, so a Hebrew note reads right to left.
const documentSx: SxProps<Theme> = {
    width: "100%",
    maxWidth: "48rem",
    mx: "auto",
    px: 4,
    py: 3,
    lineHeight: 1.65,
    "& > *": { unicodeBidi: "plaintext" },
    "& code": {
        px: 0.5,
        borderRadius: 0.5,
        bgcolor: "action.hover",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: "0.875em",
    },
    "& pre": {
        p: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
        overflowX: "auto",
        "& code": { p: 0, bgcolor: "transparent" },
    },
    "& blockquote": {
        m: 0,
        paddingInlineStart: 2,
        borderInlineStart: 4,
        borderColor: "divider",
        color: "text.secondary",
    },
};

const headingSx: SxProps<Theme> = {
    mt: 2,
    mb: 1,
    fontWeight: 600,
};

const paragraphSx: SxProps<Theme> = {
    mb: 2,
};

const MarkdownPreview = ({ text }: PreviewerProps) => {
    const blocks = useMemo(() => parseMarkdown(text ?? ""), [text]);

    return (
        <Box sx={documentSx}>
            {blocks.map((block, index) => {
                switch (block.kind) {
                    case "heading":
                        return (
                            <Typography
                                key={index}
                                dir="auto"
                                component={`h${block.level}` as "h1"}
                                variant={block.level === 1 ? "h4" : block.level === 2 ? "h5" : "h6"}
                                sx={headingSx}
                            >
                                {inline(block.text)}
                            </Typography>
                        );
                    case "list": {
                        const List = block.ordered ? "ol" : "ul";

                        return (
                            <List key={index} dir="auto">
                                {block.items.map((item, at) => (
                                    <li key={at}>{inline(item)}</li>
                                ))}
                            </List>
                        );
                    }
                    case "quote":
                        return (
                            <blockquote key={index} dir="auto">
                                {inline(block.text)}
                            </blockquote>
                        );
                    case "code":
                        // Code reads left to right, whatever the page does.
                        return (
                            <pre key={index} dir="ltr" data-no-swipe>
                                <code>{block.text}</code>
                            </pre>
                        );
                    default:
                        return (
                            <Typography key={index} dir="auto" component="p" sx={paragraphSx}>
                                {inline(block.text)}
                            </Typography>
                        );
                }
            })}
        </Box>
    );
};

/** A CSV file's rows, quotes and all, as many as `limit`. */
const parseCsv = (source: string, limit: number) => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let at = 0; at < source.length && rows.length < limit; at += 1) {
        const char = source[at];

        if (quoted) {
            if (char === '"' && source[at + 1] === '"') {
                field += '"';
                at += 1;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && source[at + 1] === "\n") {
                at += 1;
            }

            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    if ((field || row.length > 0) && rows.length < limit) {
        row.push(field);
        rows.push(row);
    }

    return rows;
};

// Wide tables scroll sideways themselves, so a swipe there doesn't step to another file.
const tableBoxSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
};

const tableSx: SxProps<Theme> = {
    borderCollapse: "collapse",
    fontSize: "0.8125rem",
    fontVariantNumeric: "tabular-nums",
    "& th, & td": {
        px: 1.5,
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        textAlign: "start",
        whiteSpace: "nowrap",
    },
    "& th": {
        position: "sticky",
        top: 0,
        bgcolor: "background.paper",
        fontWeight: 600,
    },
};

const captionSx: SxProps<Theme> = {
    px: 1.5,
    py: 0.75,
    color: "text.secondary",
};

const CsvPreview = ({ text }: PreviewerProps) => {
    const rows = useMemo(() => parseCsv(text ?? "", MAX_ROWS + 1), [text]);
    const [head, ...body] = rows;

    return (
        <Box sx={tableBoxSx} data-no-swipe>
            <Box component="table" sx={tableSx}>
                <thead>
                    <tr>{head?.map((cell, index) => <th key={index}>{cell}</th>)}</tr>
                </thead>
                <tbody>
                    {body.slice(0, MAX_ROWS).map((row, index) => (
                        <tr key={index}>
                            {row.map((cell, at) => (
                                <td key={at}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </Box>
            {body.length > MAX_ROWS && (
                <Typography variant="caption" component="p" sx={captionSx}>
                    Showing the first {MAX_ROWS.toLocaleString()} rows
                </Typography>
            )}
        </Box>
    );
};

const END_OF_DIRECTORY = 0x06054b50;
const CENTRAL_HEADER = 0x02014b50;
/** General purpose bit 11: the names are UTF-8. */
const UTF8_NAMES = 0x0800;

// MS-DOS time and date, as zip keeps them.
const dosDate = (date: number, time: number) =>
    new Date(1980 + (date >> 9), ((date >> 5) & 0xf) - 1, date & 0x1f, time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2);

/** What a zip holds, from its central directory, which says it all without unpacking anything. */
const readZip = (buffer: ArrayBuffer) => {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const utf8 = new TextDecoder();
    // Older tools wrote names in the system's own code page, which is mostly Latin.
    const legacy = new TextDecoder("windows-1252");
    let end = -1;

    // The end of the directory is the last 22 bytes, or up to 64 kB earlier with a comment.
    for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
        if (view.getUint32(at, true) === END_OF_DIRECTORY) {
            end = at;
            break;
        }
    }

    if (end < 0) {
        throw new Error("This isn't a zip archive, or it's damaged.");
    }

    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const entries: ZipEntry[] = [];

    for (let index = 0; index < count; index += 1) {
        if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_HEADER) {
            throw new Error("This zip archive is damaged.");
        }

        const flags = view.getUint16(offset + 8, true);
        const nameLength = view.getUint16(offset + 28, true);
        const name = bytes.subarray(offset + 46, offset + 46 + nameLength);
        const path = (flags & UTF8_NAMES ? utf8 : legacy).decode(name);

        entries.push({
            path,
            size: view.getUint32(offset + 24, true),
            modified: dosDate(view.getUint16(offset + 14, true), view.getUint16(offset + 12, true)),
            folder: path.endsWith("/"),
        });
        offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    }

    return entries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
};

const zipListSx: SxProps<Theme> = {
    m: 0,
    p: 1,
    listStyle: "none",
};

const zipRowSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 1.5,
    py: 0.5,
    borderRadius: 1,
    fontSize: "0.875rem",
    "&:hover": { bgcolor: "action.hover" },
};

const zipNameSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const zipMetaSx: SxProps<Theme> = {
    flexShrink: 0,
    color: "text.secondary",
    fontVariantNumeric: "tabular-nums",
};

const loadingSx: SxProps<Theme> = {
    m: "auto",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const formatSize = (bytes: number) => {
    if (bytes < 1000) {
        return `${bytes} B`;
    }

    return bytes < 1_000_000 ? `${(bytes / 1000).toFixed(1)} kB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
};

const ZipPreview = ({ content, onError }: PreviewerProps) => {
    const [entries, setEntries] = useState<ZipEntry[] | null>(null);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onErrorRef.current = onError;
    });

    useEffect(() => {
        if (!content) {
            return;
        }

        const controller = new AbortController();
        const bytes = content.blob
            ? content.blob.arrayBuffer()
            : fetch(content.url, { signal: controller.signal }).then((response) => {
                  if (!response.ok) {
                      throw new Error(`The server answered ${response.status}.`);
                  }

                  return response.arrayBuffer();
              });

        bytes
            .then((buffer) => {
                if (!controller.signal.aborted) {
                    setEntries(readZip(buffer));
                }
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    onErrorRef.current(error);
                }
            });

        return () => controller.abort();
    }, [content]);

    if (!entries) {
        return <CircularProgress size={28} aria-label="Reading the archive" sx={loadingSx} />;
    }

    return (
        <Box component="ul" sx={zipListSx} aria-label="Contents">
            {entries.map((entry) => (
                <Box component="li" key={entry.path} sx={zipRowSx}>
                    {entry.folder ? (
                        <FolderOutlined fontSize="small" color="action" />
                    ) : (
                        <InsertDriveFileOutlined fontSize="small" color="action" />
                    )}
                    <Box component="bdi" sx={zipNameSx}>
                        {entry.path}
                    </Box>
                    {!entry.folder && <Box sx={zipMetaSx}>{formatSize(entry.size)}</Box>}
                    <Box sx={zipMetaSx}>{dateFormat.format(entry.modified)}</Box>
                </Box>
            ))}
        </Box>
    );
};

/** The playground's previewers: rendered Markdown, CSV as a table, and what's in a zip. */
export const previewers: FilePreviewer[] = [
    {
        id: "markdown",
        accepts: (entry) => ["md", "markdown", "mdx"].includes(extensionOf(entry)),
        reads: "text",
        render: (props) => <MarkdownPreview {...props} />,
    },
    {
        id: "csv",
        accepts: (entry) => extensionOf(entry) === "csv" || entry.mimeType === "text/csv",
        reads: "text",
        render: (props) => <CsvPreview {...props} />,
    },
    {
        id: "zip",
        accepts: (entry) => extensionOf(entry) === "zip" || entry.mimeType === "application/zip",
        render: (props) => <ZipPreview {...props} />,
    },
];
