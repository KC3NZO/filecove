/**
 * A count from `FileManagerLimits`, whole and at least `least`, `Infinity` staying as no limit, or
 * undefined, for the default, when it's missing or not a number.
 */
export const countLimit = (count: number | undefined, least: number) =>
    count === undefined || Number.isNaN(count) ? undefined : Math.max(least, Math.floor(count));

/** A delay from `FileManagerLimits`, in ms, 0 or more, or undefined, for the default, when it's missing or not finite. */
export const delayLimit = (delay: number | undefined) =>
    delay === undefined || !Number.isFinite(delay) ? undefined : Math.max(0, delay);
