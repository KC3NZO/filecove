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
