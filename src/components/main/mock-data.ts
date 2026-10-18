import type { FileItem, LocationSection, PathSegment } from "../file-manager";

// Placeholder content for the dev host while the file manager is a layout mock-up.

export const sections: LocationSection[] = [
    {
        id: "places",
        locations: [
            {
                id: "home",
                label: "Home",
                icon: "home",
                children: [
                    { id: "home-apps", label: "Apps" },
                    {
                        id: "home-desktop",
                        label: "Desktop",
                        children: [
                            {
                                id: "home-projects",
                                label: "Projects",
                                children: [
                                    {
                                        id: "file-manager",
                                        label: "file-manager",
                                        children: [
                                            { id: "fm-docs", label: "docs" },
                                            { id: "fm-public", label: "public" },
                                            {
                                                id: "fm-src",
                                                label: "src",
                                                children: [
                                                    { id: "fm-src-assets", label: "assets" },
                                                    { id: "fm-src-components", label: "components" },
                                                ],
                                            },
                                        ],
                                    },
                                    { id: "portfolio", label: "portfolio-website-2026-redesign" },
                                ],
                            },
                            { id: "home-screenshots", label: "Screenshots" },
                        ],
                    },
                    { id: "home-documents", label: "Documents" },
                    { id: "home-downloads", label: "Downloads" },
                    { id: "home-music", label: "Music" },
                    { id: "home-pictures", label: "Pictures" },
                    { id: "home-public", label: "Public" },
                    { id: "home-snap", label: "snap" },
                    { id: "home-templates", label: "Templates" },
                    { id: "home-videos", label: "Videos" },
                ],
            },
            { id: "recent", label: "Recent", icon: "recent" },
            { id: "starred", label: "Starred", icon: "star" },
            { id: "network", label: "Network", icon: "network" },
            { id: "trash", label: "Trash", icon: "delete" },
        ],
    },
    {
        id: "bookmarks",
        locations: [
            {
                id: "documents",
                label: "Documents",
                icon: "documents",
                children: [
                    { id: "documents-invoices", label: "Invoices" },
                    { id: "documents-notes", label: "Notes" },
                ],
            },
            {
                id: "music",
                label: "Music",
                icon: "music",
                children: [{ id: "music-playlists", label: "Playlists" }],
            },
            {
                id: "pictures",
                label: "Pictures",
                icon: "pictures",
                children: [
                    { id: "pictures-screenshots", label: "Screenshots" },
                    { id: "pictures-wallpapers", label: "Wallpapers" },
                ],
            },
            { id: "videos", label: "Videos", icon: "videos" },
            {
                id: "downloads",
                label: "Downloads",
                icon: "download",
                children: [{ id: "downloads-images", label: "images" }],
            },
        ],
    },
    {
        id: "devices",
        locations: [
            {
                id: "volume",
                label: "429 GB Volume",
                icon: "drive",
                children: [
                    { id: "volume-backups", label: "Backups" },
                    { id: "volume-media", label: "Media" },
                ],
            },
            {
                id: "local-disk",
                label: "Local Disk",
                icon: "drive",
                children: [{ id: "local-disk-files", label: "files" }],
            },
        ],
    },
];

export const path: PathSegment[] = [
    { id: "home", label: "Home", icon: "home" },
    { id: "home-desktop", label: "Desktop" },
    { id: "home-projects", label: "Projects" },
    { id: "file-manager", label: "file-manager" },
];

export const defaultExpandedLocations = ["home", "home-desktop", "home-projects"];

export const defaultSelectedLocation = "file-manager";

export const items: FileItem[] = [
    { id: "1", name: ".github", kind: "folder", size: "2 items", type: "Folder", modified: "9/30/2026, 11:02" },
    { id: "2", name: "assets", kind: "folder", size: "14 items", type: "Folder", modified: "10/12/2026, 16:40" },
    { id: "3", name: "design", kind: "folder", size: "6 items", type: "Folder", modified: "10/16/2026, 09:15", starred: true },
    { id: "4", name: "docs", kind: "folder", size: "9 items", type: "Folder", modified: "10/2/2026, 13:27" },
    { id: "5", name: "node_modules", kind: "folder", size: "412 items", type: "Folder", modified: "10/17/2026, 17:58" },
    { id: "6", name: "public", kind: "folder", size: "3 items", type: "Folder", modified: "8/21/2026, 10:05" },
    { id: "7", name: "src", kind: "folder", size: "5 items", type: "Folder", modified: "10/17/2026, 18:08", starred: true },
    { id: "8", name: ".gitignore", kind: "file", size: "253 bytes", type: "Text", modified: "7/3/2026, 20:50" },
    { id: "9", name: "bun.lock", kind: "file", size: "96.4 kB", type: "Text", modified: "10/17/2026, 17:58" },
    { id: "10", name: "CLAUDE.md", kind: "file", size: "5.1 kB", type: "Markdown", modified: "10/17/2026, 18:01" },
    { id: "11", name: "index.html", kind: "file", size: "412 bytes", type: "HTML", modified: "7/18/2026, 14:22" },
    { id: "12", name: "package.json", kind: "file", size: "1.1 kB", type: "JSON", modified: "10/17/2026, 17:58" },
    { id: "13", name: "README.md", kind: "file", size: "2.2 kB", type: "Markdown", modified: "9/4/2026, 08:31" },
    { id: "14", name: "tsconfig.json", kind: "file", size: "119 bytes", type: "JSON", modified: "7/3/2026, 19:21" },
    { id: "15", name: "vite.config.ts", kind: "file", size: "171 bytes", type: "TypeScript", modified: "7/3/2026, 19:21" },
    { id: "16", name: "logo.svg", kind: "file", size: "3.8 kB", type: "Image", modified: "8/2/2026, 18:13" },
    { id: "17", name: "preview.png", kind: "file", size: "1.4 MB", type: "Image", modified: "10/16/2026, 14:54" },
    { id: "18", name: "walkthrough.mp4", kind: "file", size: "48.2 MB", type: "Video", modified: "10/15/2026, 10:16" },
    { id: "19", name: "theme.css", kind: "file", size: "105 bytes", type: "CSS", modified: "7/13/2026, 17:02" },
    { id: "20", name: "setup.sh", kind: "file", size: "2.6 kB", type: "Shell script", modified: "7/26/2026, 22:17" },
    { id: "21", name: "usage-report.pdf", kind: "file", size: "811 kB", type: "PDF", modified: "10/1/2026, 12:26" },
    { id: "22", name: "metrics.csv", kind: "file", size: "24.9 kB", type: "Spreadsheet", modified: "10/10/2026, 09:44" },
    { id: "23", name: "release-1.0.0.zip", kind: "file", size: "3.3 MB", type: "Archive", modified: "10/14/2026, 14:26" },
    {
        id: "24",
        name: "a-very-long-file-name-that-should-truncate-gracefully-in-every-layout.md",
        kind: "file",
        size: "400 bytes",
        type: "Markdown",
        modified: "7/14/2026, 22:44",
    },
];
