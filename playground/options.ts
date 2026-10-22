// The playground's switches, read from the URL once, and combined as needed (`?rtl&locale=ar-EG`).
const params = new URLSearchParams(window.location.search);

/** `?single`: the file manager with one section, whose folders fill the sidebar. */
export const single = params.has("single");

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
