/** Joins the class names that apply, leaving out the false, null and undefined ones. */
export const cx = (...names: (string | false | null | undefined)[]): string | undefined =>
    names.filter(Boolean).join(" ") || undefined;
