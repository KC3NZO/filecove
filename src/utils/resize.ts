/** A docked panel's width within its limits, whole pixels. */
export const clampWidth = (width: number, min: number, max: number) =>
    Math.round(Math.max(min, Math.min(width, max)));
