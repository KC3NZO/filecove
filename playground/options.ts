import type { FileManagerLimits } from "../src";

// The playground's switches, read from the URL once, and combined as needed (`?rtl&locale=ar-EG`).
const params = new URLSearchParams(window.location.search);

/** `?single`: the file manager with one section, whose folders fill the sidebar. */
export const single = params.has("single");

/**
 * `?uncontrolled`: the file manager keeps its location, view settings and selection itself. By
 * default the playground keeps them: the location in the URL's hash, so a reload or the browser's
 * back button follows it, and the view settings in local storage. Uncontrolled, those only set where
 * it starts (the `default…` props), and the footer still shows the selection it's told.
 */
export const uncontrolled = params.has("uncontrolled");

/**
 * `?rtl`: the page right to left with nothing but `dir="rtl"` on `<html>`, which is all the file
 * manager asks of a page. The theme's `direction` and Emotion's RTL plugin are left out, so this is
 * how to check it looks right without them.
 */
export const rtl = params.has("rtl");

/**
 * `?rtl=mui`: the same, set up as MUI's guide says for a right-to-left app: the theme's `direction`
 * and an Emotion cache with `stylis-plugin-rtl`. For checking that a consumer who has those still
 * gets the right result, with nothing flipped twice.
 */
export const muiRtl = rtl && params.get("rtl") === "mui";

/**
 * `?locale=ar-EG`: the file manager's `locale`, for its numbers, sizes, dates and the order of
 * names. Its text stays English, since the playground has no translation.
 */
export const locale = params.get("locale") || undefined;

/**
 * `?downloadUrls`: the media bucket hands some files over to download as URLs on another origin, as
 * a bucket's signed links would be, to see how the file manager saves those. `release-1.0.0.zip` is
 * a GitHub archive, sent as an attachment, so a tab opens and closes as the browser saves it;
 * `intro.webm` is MDN's sample, which isn't, so it plays in that tab; and `walkthrough.mp4` comes
 * after 7 s, too late for the browser to open a tab on its own, so it waits in the download panel
 * for a click. They need the network.
 */
export const downloadUrls = params.has("downloadUrls");

/**
 * `?relistAfter=30000`: the file manager's `relistAfter`, how old a folder's listing may be, in ms,
 * before opening the folder lists it again; `?relistAfter=Infinity` never does. Every time when
 * left out. The footer's "Change elsewhere" adds a file the file manager isn't told of, to see it.
 */
const relistParam = params.get("relistAfter");

export const relistAfter =
    relistParam !== null && !Number.isNaN(Number(relistParam)) ? Number(relistParam) : undefined;

/**
 * `?limits=uploads:1,thumbnails:2`: the file manager's `limits`, each `key:number` of
 * `FileManagerLimits` (`uploads`, `downloads`, `transfers`, `thumbnails`, `keptThumbnails`,
 * `keptEntries`, `undoSteps`, `searchDelay`), `Infinity` for no limit. The defaults when left out.
 * One upload or copy at a time shows the rest waiting in their panels, `keptEntries:0` drops every
 * listing once nothing shows it, so a folder opened again is listed afresh, and `undoSteps:1` keeps
 * only the last change to undo, as GNOME Files does.
 */
export const limits: FileManagerLimits | undefined = params.has("limits")
    ? Object.fromEntries(
          (params.get("limits") ?? "")
              .split(",")
              .map((pair) => pair.split(":"))
              .filter(([key, value]) => key && value && !Number.isNaN(Number(value)))
              .map(([key, value]) => [key.trim(), Number(value)]),
      )
    : undefined;

/**
 * `?huge`: API service also has `huge`, a folder of 200,000 files, too many for the list to be laid
 * out whole, as browsers cap an element's height, so it's squeezed (see "Lists too tall for the
 * browser" in `virtualization.md`). The server lists 50,000 entries a page meanwhile, so it comes
 * in seconds.
 */
export const huge = params.has("huge");

/**
 * `?lateSections`: the sections come 3 s after the page opens, as an app getting them from its
 * server would, to see the file manager with none meanwhile. Not with `?single`, which has its one.
 */
export const lateSections = params.has("lateSections");

/**
 * `?media`: the media manager in place of the file manager, choosing from the libraries in
 * `mocks/mock-media.ts`; with `?single`, from Images alone. What's chosen shows in the footer.
 */
export const media = params.has("media");

/**
 * `?media&many`: Images holds 10,000 pictures, to see the grid render only the tiles in or near view
 * (see "The media grid" in `virtualization.md`).
 */
export const manyMedia = media && params.has("many");

/** `?media&multiple`: several files can be chosen at once. */
export const multiple = params.has("multiple");

/** `?media&multiple&max=5`: the media manager's `maxChoices`, as many as can be selected at once. */
const maxParam = params.get("max");

export const maxChoices = maxParam !== null && !Number.isNaN(Number(maxParam)) ? Number(maxParam) : undefined;

/** `?media&multiple&oneVideo`: the media manager's `canSelect`, with one video at most among the picks. */
export const oneVideo = params.has("oneVideo");

/** `?media&selectGroups`: the media manager's and the picker's `selectGroups`, a group having a check of its own. */
export const selectGroups = params.has("selectGroups");

/**
 * `?media&selectGroups&oneGroup`: the gallery's `MediaPicker` takes `canSelect`, with one group at most
 * among its picks, the others saying why.
 */
export const oneGroup = params.has("oneGroup");

/**
 * `?media&multiple&selectGroups&noOverlap`: `canSelect` on the media manager and the gallery's `MediaPicker`
 * refuses what's inside a group picked, and a group with a pick inside it.
 */
export const noOverlap = params.has("noOverlap");

/** `?media&browse`: no `onChoose`, so the media manager is a library to look through, without Choose. */
export const browse = params.has("browse");

/**
 * `?media&live`: no `onChoose`, so there's no Choose, and the app takes the picks as they change, as
 * for a field in a form of its own, saved by its own button. The footer shows them.
 */
export const live = params.has("live");

/**
 * `?media&push`: the media backend pushes how its assets' processing stands (`watchProcessing`, a
 * timer standing in for a socket) rather than being polled for it (`processing`).
 */
export const push = params.has("push");
