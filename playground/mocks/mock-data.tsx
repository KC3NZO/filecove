import CloudOutlined from "@mui/icons-material/CloudOutlined";
import FileCopyOutlined from "@mui/icons-material/FileCopyOutlined";
import FolderZipOutlined from "@mui/icons-material/FolderZipOutlined";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";

import { downloadUrls } from "../options";
import { createMockAdapter, file, folder } from "./mock-adapter";

import type { ActionContext, ActionGroup, MainMenuGroup, SectionGroup } from "../../src";
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

const archiveTypes = ["csv", "json", "pdf", "png", "zip", "txt", "md", "svg"];

/** A folder large enough that the content only renders what's in view, to try virtualization. */
const archive: MockNode[] = Array.from({ length: 10_000 }, (_, index) =>
    file(
        `record-${String(index + 1).padStart(5, "0")}.${archiveTypes[index % archiveTypes.length]}`,
        2_000 + ((index * 7_919) % 900_000),
        new Date(Date.UTC(2024, 0, 1) + index * 3_600_000).toISOString(),
    ),
);

/** A folder of folders large enough that the sidebar tree only renders what's in view. */
const datasets: MockNode[] = Array.from({ length: 5_000 }, (_, index) => {
    const name = `set-${String(index + 1).padStart(4, "0")}`;
    const modified = new Date(Date.UTC(2025, 0, 1) + index * 86_400_000).toISOString();

    return folder(name, modified, [file(`${name}.parquet`, 40_000 + index * 13, modified)]);
});

/** One backend serving two unrelated project roots, as in "/server/project/a" and "/server/project/b". */
export const serverAdapter = createMockAdapter({
    "/server/project/a": [
        folder(".github", "2026-09-30T11:02", [
            folder("workflows", "2026-09-30T11:02", [file("ci.yml", 1_204, "2026-09-30T11:02")]),
        ]),
        folder("docs", "2026-10-02T13:27", [
            file("architecture.pdf", 811_000, "2026-10-01T12:26", "application/pdf"),
            file("CHANGELOG.md", 6_120, "2026-10-17T17:40"),
            // Can't be read, to show the preview's error state.
            { ...file("contract.pdf", 412_000, "2026-10-08T15:12", "application/pdf"), fails: true },
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
        // "Documents": names in Arabic and Hebrew, mixed with Latin, or starting and ending with
        // punctuation, to try text running both ways, with `?rtl` and without.
        folder("مستندات", "2026-10-20T09:30", [
            folder("صور", "2026-10-20T09:30", [
                file("غلاف (نهائي).png", 940_000, "2026-10-20T09:30", "image/png"),
            ]),
            file("تقرير الربع الثالث.pdf", 318_000, "2026-10-19T11:05", "application/pdf"),
            file("סיכום פגישה.md", 2_400, "2026-10-18T16:20"),
            file("ملاحظات (2).txt", 820, "2026-10-17T10:12", "text/plain"),
            file("Q3 تقرير.xlsx", 64_000, "2026-10-16T08:45"),
            file("(draft) roadmap.md", 1_900, "2026-10-15T14:30"),
        ]),
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
        folder("archive", "2026-10-01T09:00", archive),
        folder("datasets", "2026-10-05T12:00", datasets),
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
    {
        latency: [600, 1200],
        // `?downloadUrls`, to see URLs on another origin saved (see `options.ts`).
        downloadUrls: downloadUrls
            ? {
                  "/release-1.0.0.zip": {
                      url: "https://github.com/octocat/Hello-World/archive/refs/heads/master.zip",
                  },
                  "/videos/intro.webm": { url: "https://mdn.github.io/shared-assets/videos/flower.webm" },
                  "/videos/walkthrough.mp4": {
                      url: "https://mdn.github.io/shared-assets/videos/flower.mp4",
                      delay: 7000,
                  },
              }
            : undefined,
    },
);

// The three server sections show each kind of `importFrom`: Website takes entries only from API
// service, API service from anything but Design assets, and Design assets from nothing else, nor
// uploads.
export const sections: SectionGroup[] = [
    {
        id: "projects",
        title: "Projects",
        sections: [
            {
                id: "project-a",
                label: "Website",
                icon: <LanguageOutlined />,
                rootId: "/server/project/a",
                importFrom: { allow: ["project-b"] },
            },
            {
                id: "project-b",
                label: "API service",
                icon: "network",
                rootId: "/server/project/b",
                importFrom: { deny: ["design"] },
            },
        ],
    },
    {
        id: "storage",
        title: "Storage",
        sections: [
            {
                id: "design",
                label: "Design assets",
                icon: "pictures",
                rootId: "/shared/design",
                showFolders: false,
                importFrom: false,
                acceptUploads: false,
            },
            // Takes only pictures, videos and sound, to show a section limiting the files uploaded.
            {
                id: "media",
                label: "Media bucket",
                icon: <CloudOutlined />,
                rootId: "/",
                adapter: mediaAdapter,
                acceptUploads: "image/*,video/*,audio/*",
            },
        ],
    },
    // A bookmark rooted inside Website, so the same folders show in two sections, under the same ids.
    {
        id: "bookmarks",
        title: "Bookmarks",
        sections: [{ id: "website-src", label: "Website source", icon: "folder", rootId: "/server/project/a/src" }],
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
                visible: (context) => !!context.open,
                onSelect: (context) => context.open?.(),
            },
            {
                // Only on a search everywhere's results, which come from anywhere.
                id: "open-location",
                label: "Open item location",
                icon: "folder",
                target: "selection",
                single: true,
                visible: (context) => !!context.openLocation,
                onSelect: (context) => context.openLocation?.(),
            },
            {
                id: "preview",
                label: "Preview",
                icon: "preview",
                shortcut: "Space",
                target: "selection",
                visible: (context) => !!context.preview,
                onSelect: (context) => context.preview?.(),
            },
            {
                id: "download",
                label: "Download",
                icon: "download",
                // On a folder's empty space, the path bar or a section row, it downloads the folder itself.
                visible: (context) => !!context.download,
                onSelect: (context) => context.download?.(),
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
                id: "new-folder-inside",
                label: "New folder inside…",
                icon: "newFolder",
                target: "selection",
                single: true,
                visible: (context) => !!context.createFolderInto,
                onSelect: (context) => context.createFolderInto?.(),
            },
            {
                id: "upload",
                label: "Upload files…",
                icon: "upload",
                target: "folder",
                visible: (context) => !!context.upload,
                onSelect: (context) => context.upload?.(),
            },
            {
                id: "upload-folder",
                label: "Upload folder…",
                icon: "uploadFolder",
                target: "folder",
                visible: (context) => !!context.uploadFolder,
                onSelect: (context) => context.uploadFolder?.(),
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
                visible: (context) => !!context.cut,
                onSelect: (context) => context.cut?.(),
            },
            {
                id: "copy",
                label: "Copy",
                icon: "copy",
                shortcut: "Ctrl+C",
                target: "selection",
                visible: (context) => !!context.copy,
                onSelect: (context) => context.copy?.(),
            },
            {
                id: "paste",
                label: "Paste",
                icon: "paste",
                shortcut: "Ctrl+V",
                target: "folder",
                // Stays in the menu, greyed out, while there is nothing to paste here.
                disabled: (context) => !context.paste,
                onSelect: (context) => context.paste?.(),
            },
            {
                id: "paste-into",
                label: "Paste into folder",
                icon: "paste",
                target: "selection",
                single: true,
                visible: (context) => context.entries[0].kind === "folder",
                disabled: (context) => !context.pasteInto,
                onSelect: (context) => context.pasteInto?.(),
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
                label: "Delete…",
                icon: "delete",
                shortcut: "Delete",
                target: "selection",
                destructive: true,
                visible: (context) => !!context.delete,
                onSelect: (context) => context.delete?.(),
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
                onSelect: (context) => context.properties(),
            },
        ],
    },
];

/** Demo items for the sidebar's main menu, an app's own, which only report that they ran. */
export const createDemoMainMenu = (notify: (message: string) => void): MainMenuGroup[] => [
    {
        id: "app",
        items: [
            {
                id: "preferences",
                label: "Preferences",
                shortcut: "Ctrl+,",
                onSelect: () => notify("Preferences"),
            },
            {
                id: "about",
                label: "About Files",
                onSelect: () => notify("File manager playground"),
            },
        ],
    },
];
