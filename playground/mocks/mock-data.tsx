import CloudOutlined from "@mui/icons-material/CloudOutlined";
import FileCopyOutlined from "@mui/icons-material/FileCopyOutlined";
import FolderZipOutlined from "@mui/icons-material/FolderZipOutlined";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";

import { createMockAdapter, file, folder } from "./mock-adapter";

import type { ActionContext, ActionGroup, SectionGroup } from "../../src";
import type { MockNode } from "./mock-adapter";

// Placeholder backends and configuration for the dev host.

const logs: MockNode[] = Array.from({ length: 120 }, (_, index) =>
    file(
        `api-${String(index + 1).padStart(3, "0")}.log`,
        18_000 + index * 731,
        new Date(Date.UTC(2026, 5, 20 + index, 3)).toISOString(),
        "text/plain",
    ),
);

/** One backend serving two unrelated project roots, as in "/server/project/a" and "/server/project/b". */
export const serverAdapter = createMockAdapter({
    "/server/project/a": [
        folder(".github", "2026-09-30T11:02", [
            folder("workflows", "2026-09-30T11:02", [file("ci.yml", 1_204, "2026-09-30T11:02")]),
        ]),
        folder("docs", "2026-10-02T13:27", [
            file("architecture.pdf", 811_000, "2026-10-01T12:26", "application/pdf"),
            file("CHANGELOG.md", 6_120, "2026-10-17T17:40"),
        ]),
        folder("public", "2026-08-21T10:05", [
            folder("images", "2026-08-21T10:05", [
                file("hero.png", 1_400_000, "2026-08-21T10:05", "image/png"),
                file("logo.svg", 3_800, "2026-08-02T18:13", "image/svg+xml"),
            ]),
            file("favicon.svg", 1_100, "2026-07-03T19:21", "image/svg+xml"),
            file("robots.txt", 68, "2026-07-03T19:21", "text/plain"),
        ]),
        { ...folder("restricted", "2026-10-11T08:00", []), fails: true },
        folder("src", "2026-10-17T18:08", [
            folder("assets", "2026-10-12T16:40", []),
            folder("components", "2026-10-17T18:08", [
                file("header.tsx", 2_480, "2026-10-17T18:08"),
                file("file-list.tsx", 5_930, "2026-10-17T17:51"),
                file("sidebar.tsx", 4_310, "2026-10-16T09:15"),
            ]),
            folder("hooks", "2026-10-09T14:12", [file("use-folder.ts", 1_120, "2026-10-09T14:12")]),
            file("app.tsx", 640, "2026-10-17T18:01"),
            file("main.tsx", 280, "2026-07-03T19:21"),
        ]),
        file(".gitignore", 253, "2026-07-03T20:50"),
        file("bun.lock", 96_400, "2026-10-17T17:58"),
        file("index.html", 412, "2026-07-18T14:22", "text/html"),
        file("package.json", 1_100, "2026-10-17T17:58", "application/json"),
        file("README.md", 2_200, "2026-09-04T08:31"),
        file("tsconfig.json", 119, "2026-07-03T19:21", "application/json"),
        file("vite.config.ts", 171, "2026-07-03T19:21"),
        file("a-very-long-file-name-that-should-truncate-gracefully-in-every-layout.md", 400, "2026-07-14T22:44"),
    ],
    "/server/project/b": [
        folder("cmd", "2026-09-12T10:30", [
            folder("server", "2026-09-12T10:30", [file("main.go", 2_950, "2026-09-12T10:30")]),
        ]),
        folder("internal", "2026-10-15T16:02", [
            folder("handlers", "2026-10-15T16:02", [file("files.go", 8_420, "2026-10-15T16:02")]),
            folder("store", "2026-10-03T11:47", [file("postgres.go", 11_300, "2026-10-03T11:47")]),
        ]),
        folder("logs", "2026-10-17T03:00", logs),
        folder("migrations", "2026-08-28T09:10", [
            file("001_init.sql", 3_400, "2026-07-11T09:10"),
            file("002_add_sharing.sql", 1_250, "2026-08-28T09:10"),
        ]),
        file("docker-compose.yml", 860, "2026-09-02T13:00"),
        file("Dockerfile", 540, "2026-09-02T13:00"),
        file("go.mod", 310, "2026-10-15T16:02"),
        file("go.sum", 24_900, "2026-10-15T16:02"),
        file("README.md", 3_100, "2026-09-20T18:44"),
    ],
    "/shared/design": [
        folder("brand", "2026-06-30T12:00", [
            file("colors.pdf", 220_000, "2026-06-30T12:00", "application/pdf"),
            file("logo.svg", 3_800, "2026-06-30T12:00", "image/svg+xml"),
        ]),
        folder("mockups", "2026-10-16T14:54", [
            file("home.png", 1_820_000, "2026-10-16T14:54", "image/png"),
            file("settings.png", 1_310_000, "2026-10-14T10:20", "image/png"),
        ]),
        folder("archive", "2025-12-01T09:00", []),
    ],
});

/** A second, unrelated backend, used by one section only. */
const mediaAdapter = createMockAdapter(
    {
        "/": [
            folder("audio", "2026-09-01T08:00", [file("theme.mp3", 4_200_000, "2026-09-01T08:00", "audio/mpeg")]),
            folder("videos", "2026-10-15T10:16", [
                file("walkthrough.mp4", 48_200_000, "2026-10-15T10:16", "video/mp4"),
                file("intro.webm", 12_700_000, "2026-09-08T19:40", "video/webm"),
            ]),
            file("release-1.0.0.zip", 3_300_000, "2026-10-14T14:26", "application/zip"),
        ],
    },
    { latency: [600, 1200] },
);

export const sections: SectionGroup[] = [
    {
        id: "projects",
        title: "Projects",
        sections: [
            { id: "project-a", label: "Website", icon: <LanguageOutlined />, rootId: "/server/project/a" },
            { id: "project-b", label: "API service", icon: "network", rootId: "/server/project/b" },
        ],
    },
    {
        id: "storage",
        title: "Storage",
        sections: [
            { id: "design", label: "Design assets", icon: "pictures", rootId: "/shared/design", showFolders: false },
            { id: "media", label: "Media bucket", icon: <CloudOutlined />, rootId: "/", adapter: mediaAdapter },
        ],
    },
];

const names = (context: ActionContext) => {
    if (context.target === "folder") {
        return context.folder.name;
    }

    return context.entries.length > 3
        ? `${context.entries.length} items`
        : context.entries.map((entry) => entry.name).join(", ");
};

/** Demo actions; most only report that they ran. Those marked `single` hide while several entries are selected. */
export const createDemoActions = (notify: (message: string) => void): ActionGroup[] => [
    {
        id: "open",
        actions: [
            {
                id: "open",
                label: "Open",
                icon: "folderOpen",
                target: "selection",
                single: true,
                visible: (context) => context.entries[0].kind === "folder",
                onSelect: (context) => context.openFolder(context.entries[0]),
            },
            {
                id: "download",
                label: "Download",
                icon: "download",
                target: "selection",
                visible: (context) => context.entries.every((entry) => entry.kind === "file"),
                onSelect: (context) => notify(`Download ${names(context)}`),
            },
        ],
    },
    {
        id: "create",
        actions: [
            {
                id: "new-folder",
                label: "New folder…",
                icon: "newFolder",
                shortcut: "Shift+Ctrl+N",
                target: "folder",
                visible: (context) => !!context.createFolder,
                onSelect: (context) => context.createFolder?.(),
            },
            {
                id: "upload",
                label: "Upload files",
                icon: "upload",
                target: "folder",
                onSelect: (context) => notify(`Upload to ${context.folder.name}`),
            },
        ],
    },
    {
        id: "clipboard",
        actions: [
            {
                id: "cut",
                label: "Cut",
                icon: "cut",
                shortcut: "Ctrl+X",
                target: "selection",
                onSelect: (context) => notify(`Cut ${names(context)}`),
            },
            {
                id: "copy",
                label: "Copy",
                icon: "copy",
                shortcut: "Ctrl+C",
                target: "selection",
                onSelect: (context) => notify(`Copy ${names(context)}`),
            },
            {
                id: "paste",
                label: "Paste",
                icon: "paste",
                shortcut: "Ctrl+V",
                target: "folder",
                // Nothing is ever cut or copied in the demo, so this shows the disabled state.
                disabled: () => true,
                onSelect: () => undefined,
            },
        ],
    },
    {
        id: "organize",
        actions: [
            {
                id: "copy-to",
                label: "Copy to…",
                icon: <FileCopyOutlined />,
                target: "selection",
                visible: (context) => !!context.copyTo,
                onSelect: (context) => context.copyTo?.(),
            },
            {
                id: "move-to",
                label: "Move to…",
                icon: "move",
                target: "selection",
                visible: (context) => !!context.moveTo,
                onSelect: (context) => context.moveTo?.(),
            },
            {
                id: "compress",
                label: "Compress…",
                icon: <FolderZipOutlined />,
                target: "selection",
                onSelect: (context) => notify(`Compress ${names(context)}`),
            },
        ],
    },
    {
        id: "edit",
        actions: [
            {
                id: "rename",
                label: "Rename…",
                icon: "rename",
                shortcut: "F2",
                target: "selection",
                single: true,
                visible: (context) => !!context.rename,
                onSelect: (context) => context.rename?.(),
            },
            {
                id: "share",
                label: "Share",
                icon: "share",
                target: "selection",
                onSelect: (context) => notify(`Share ${names(context)}`),
            },
        ],
    },
    {
        id: "danger",
        actions: [
            {
                id: "delete",
                label: "Delete",
                icon: "delete",
                shortcut: "Delete",
                target: "selection",
                destructive: true,
                onSelect: (context) => notify(`Delete ${names(context)}`),
            },
        ],
    },
    {
        id: "view",
        actions: [
            {
                id: "refresh",
                label: "Refresh",
                icon: "refresh",
                shortcut: "F5",
                target: "folder",
                onSelect: (context) => context.refresh(),
            },
            {
                id: "properties",
                label: "Properties",
                icon: "info",
                onSelect: (context) => notify(`Properties of ${names(context)}`),
            },
        ],
    },
];
