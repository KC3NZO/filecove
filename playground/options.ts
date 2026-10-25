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
 * `keptEntries`, `searchDelay`), `Infinity` for no limit. The defaults when left out. One upload or
 * copy at a time shows the rest waiting in their panels, and `keptEntries:0` drops every listing
 * once nothing shows it, so a folder opened again is listed afresh.
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
 * `?lateSections`: the sections come 3 s after the page opens, as an app getting them from its
 * server would, to see the file manager with none meanwhile. Not with `?single`, which has its one.
 */
export const lateSections = params.has("lateSections");
