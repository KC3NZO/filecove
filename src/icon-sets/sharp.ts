import { createIcon } from "../components/icons/create-icon";

import type { IconSet } from "../types";

// Material Icons, Sharp, as Google publishes them under the Apache License 2.0: each icon's
// shapes on a 24 by 24 grid, drawn by `createIcon`. Source: https://github.com/google/material-design-icons.
// The license and notice are in THIRD_PARTY_NOTICES.md at the package root.

/**
 * The Material icons in their Sharp style, for `<IconProvider icons={sharpIcons}>`. Each style is
 * a module of its own, the package's `icons/sharp`, so an app ships only the styles it imports.
 */
export const sharpIcons: IconSet = {
    add: createIcon("M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"),
    arrowBack: createIcon("M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"),
    arrowDown: createIcon("m20 12-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z"),
    arrowForward: createIcon("m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"),
    arrowUp: createIcon("m4 12 1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8z"),
    check: createIcon("M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"),
    chevronLeft: createIcon("M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"),
    chevronRight: createIcon("M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"),
    close: createIcon(
        "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    ),
    copy: createIcon("M16 1H2v16h2V3h12zm5 4H6v18h15zm-2 16H8V7h11z"),
    cut: createIcon(
        "M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2m0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2m6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5M19 3l-6 6 2 2 7-7V3z",
    ),
    delete: createIcon("M6 21h12V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"),
    deleteForever: createIcon(
        "M6 21h12V7H6zm2.46-9.12 1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14zM15.5 4l-1-1h-5l-1 1H5v2h14V4z",
    ),
    desktop: createIcon("M23 2H1v16h9v2H8v2h8v-2h-2v-2h9zm-2 14H3V4h18z"),
    documents: createIcon("M14 2H4v20h16V8zm2 16H8v-2h8zm0-4H8v-2h8zm-3-5V3.5L18.5 9z"),
    download: createIcon("M19 9h-4V3H9v6H5l7 7zM5 18v2h14v-2z"),
    drive: createIcon("M2 20h20v-4H2zm2-3h2v2H4zM2 4v4h20V4zm4 3H4V5h2zm-4 7h20v-4H2zm2-3h2v2H4z"),
    edit: createIcon("M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM21.41 6.34l-3.75-3.75-2.53 2.54 3.75 3.75z"),
    expand: createIcon("M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"),
    file: createIcon("M4.01 2 4 22h16V8l-6-6zM13 9V3.5L18.5 9z"),
    filter: createIcon("M10 18h4v-2h-4zM3 6v2h18V6zm3 7h12v-2H6z"),
    folder: createIcon("M10 4H2v16h20V6H12z"),
    folderOpen: createIcon("M22 6H12l-2-2H2v16h20zm-2 12H4V8h16z"),
    fullScreen: createIcon("M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"),
    fullScreenExit: createIcon("M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z"),
    gridView: createIcon("M3 3h8v8H3zm0 10h8v8H3zM13 3h8v8h-8zm0 10h8v8h-8z"),
    home: createIcon("M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"),
    info: createIcon("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 15h-2v-6h2zm0-8h-2V7h2z"),
    listView: createIcon("M3 14h4v-4H3zm0 5h4v-4H3zM3 9h4V5H3zm5 5h13v-4H8zm0 5h13v-4H8zM8 5v4h13V5z"),
    lock: createIcon(
        "M20 8h-3V6.21c0-2.61-1.91-4.94-4.51-5.19C9.51.74 7 3.08 7 6v2H4v14h16zm-8 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2z",
    ),
    menu: createIcon("M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z"),
    more: createIcon(
        "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2",
    ),
    move: createIcon("M22 6H12l-2-2H2v16h20zM12 17v-3H8v-2h4V9l4 4z"),
    music: createIcon("M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3z"),
    network: createIcon(
        "M21 13H3v8h18zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2M21 3H3v8h18zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2",
    ),
    newFolder: createIcon("M22 6H12l-2-2H2v16h20zm-3 8h-3v3h-2v-3h-3v-2h3V9h2v3h3z"),
    paste: createIcon(
        "M21 2h-6.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H3v20h18zm-9 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1m7 18H5V4h2v3h10V4h2z",
    ),
    pictures: createIcon("M21 21V3H3v18zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5z"),
    preview: createIcon(
        "M12 4C7 4 2.73 7.11 1 11.5 2.73 15.89 7 19 12 19s9.27-3.11 11-7.5C21.27 7.11 17 4 12 4m0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3",
    ),
    recent: createIcon(
        "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9m-1 5v5l4.25 2.52.77-1.29-3.52-2.09V8z",
    ),
    refresh: createIcon(
        "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z",
    ),
    rename: createIcon(
        "m15 16-4 4h10v-4zm-2.94-8.81L3 16.25V20h3.75l9.06-9.06zm1.0721-1.0674 2.5386-2.5385 3.7476 3.7476-2.5385 2.5386z",
    ),
    restore: createIcon("M6 21h12V7H6zm6-11 4 4h-2v4h-4v-4H8zm3.5-6-1-1h-5l-1 1H5v2h14V4z"),
    rotateLeft: createIcon(
        "M7.11 8.53 5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47M6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47m1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93",
    ),
    rotateRight: createIcon(
        "M15.55 5.55 11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03m3.89-2.42 1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48",
    ),
    search: createIcon(
        "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14",
    ),
    searchFolder: createIcon(
        "M7 9H2V7h5zm0 3H2v2h5zm13.59 7-3.83-3.83c-.8.52-1.74.83-2.76.83-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 1.02-.31 1.96-.83 2.75L22 17.59zM17 11c0-1.65-1.35-3-3-3s-3 1.35-3 3 1.35 3 3 3 3-1.35 3-3M2 19h10v-2H2z",
    ),
    selectAll: createIcon(
        "M3 13h2v-2H3zm4 8h2v-2H7zM3 9h2V7H3zm10-6h-2v2h2zM3 17h2v-2H3zM9 3H7v2h2zM5 3H3v2h2zm6 18h2v-2h-2zm8-8h2v-2h-2zm0-4h2V7h-2zm0 8h2v-2h-2zm-4 4h2v-2h-2zm0-16h2V3h-2zm4 0h2V3h-2zm0 16h2v-2h-2zM3 21h2v-2H3zm4-4h10V7H7zm2-8h6v6H9z",
    ),
    selectMode: createIcon(
        "M22 7h-9v2h9zm0 8h-9v2h9zM5.54 11 2 7.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41zm0 8L2 15.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41z",
    ),
    settings: createIcon(
        "m19.44 12.99-.01.02c.04-.33.08-.67.08-1.01s-.03-.66-.07-.99l.01.02 2.44-1.92-2.43-4.22-2.87 1.16.01.01c-.52-.4-1.09-.74-1.71-1h.01L14.44 2H9.57l-.44 3.07h.01c-.62.26-1.19.6-1.71 1l.01-.01-2.88-1.17-2.44 4.22 2.44 1.92.01-.02c-.04.33-.07.65-.07.99s.03.68.08 1.01l-.01-.02-2.1 1.65-.33.26 2.43 4.2 2.88-1.15-.02-.04c.53.41 1.1.75 1.73 1.01h-.03L9.58 22h4.85s.03-.18.06-.42l.38-2.65h-.01c.62-.26 1.2-.6 1.73-1.01l-.02.04 2.88 1.15 2.43-4.2s-.14-.12-.33-.26zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5",
    ),
    share: createIcon(
        "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92",
    ),
    sort: createIcon("M3 18h6v-2H3zM3 6v2h18V6zm0 7h12v-2H3z"),
    star: createIcon("M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"),
    starBorder: createIcon(
        "m22 9.24-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28z",
    ),
    upload: createIcon("M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"),
    uploadFolder: createIcon("M22 6H12l-2-2H2v16h20zm-9 7v4h-2v-4H8l4.01-4L16 13z"),
    videos: createIcon(
        "m18 4 2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4z",
    ),
    zoomFit: createIcon("M17 4h5v5h-2V6h-3zM4 9V6h3V4H2v5zm16 6v3h-3v2h5v-5zM7 18H4v-3H2v5h5zM18 8H6v8h12z"),
    zoomIn: createIcon(
        "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14m.5-7H9v2H7v1h2v2h1v-2h2V9h-2z",
    ),
    zoomOut: createIcon(
        "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14M7 9h5v1H7z",
    ),
};
