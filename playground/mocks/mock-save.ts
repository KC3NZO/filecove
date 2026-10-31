import { pollRenditions } from "./mock-media";

import type { FieldErrors, MediaChoice } from "../../src";

// The playground's stand-in for the app's own backend, which the picks are saved to, as a product's
// carousel would be: sent as `media`, in the order set, and checked as a Laravel form request would
// check them, answering a 422's `errors`, by its own keys, a list of messages each: the list's own
// (`media`), a pick's own (`media.0`, `media.0.id`) and its fields' (`media.0.translations.en.alt`,
// `media.0.focus`). The media manager never sees this: the app hands what comes back to its `errors`.

/** How many slides the carousel takes, which the backend holds the list to. */
const MOST = 8;

const has = (value: unknown) => value !== undefined && value !== null && value !== "";

/** A text in one language of a field holding one a language, as the video's title does. */
const inLanguage = (value: unknown, code: string) =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>)[code] : undefined;

/**
 * What one pick fails, under its own keys, without the `media.N` the request puts before them; the
 * pick's own, about it as a whole, under "", which is `media.N` itself.
 */
const problemsOf = async ({ asset, section, values }: MediaChoice): Promise<Record<string, string[]>> => {
    const problems: Record<string, string[]> = {};

    // A stock photo whose licence has run out, one in six.
    if (section.id === "stock" && /-(?:06|12|18)\./.test(asset.name)) {
        problems.id = ["This stock photo's licence has run out, so it can't be used."];
    }

    if (section.kind === "image") {
        if (!values.decorative && !has(values["alt.en"])) {
            problems["translations.en.alt"] = ["The English alt text is required unless the picture is decorative."];
        }

        if (values.fit === "contain" && has(values.focus) && values.focus !== "center") {
            problems.focus = ["The focal point is only used when the picture fills the slide."];
        }
    }

    if (section.kind === "video") {
        const renditions = await pollRenditions(asset);

        if (renditions.some(({ status }) => status === "queued" || status === "processing")) {
            problems[""] = ["This video is still being processed, so it can't go on the carousel yet."];
        }

        if (!has(inLanguage(values.title, "en"))) {
            problems["translations.en.title"] = ["The English title is required."];
        }

        const length = asset.media?.duration;

        if (typeof values.start === "number" && length !== undefined && values.start >= length) {
            problems.start = [`Start at must be less than the video's length, ${Math.floor(length)} seconds.`];
        }

        if (values.autoplay && !values.loop && values.showOn === undefined) {
            problems.showOn = ["Choose where a video playing on its own shows."];
        }
    }

    return problems;
};

/**
 * Saves the picks, after a moment, answering the errors as Laravel does, keyed by each pick's place
 * in the request, or nothing once they're all fine.
 */
export const savePicks = async (choices: readonly MediaChoice[]): Promise<FieldErrors | null> => {
    const [answers] = await Promise.all([
        Promise.all(choices.map(problemsOf)),
        new Promise((resolve) => setTimeout(resolve, 400)),
    ]);
    const errors: Record<string, string[]> = {};

    if (choices.length > MOST) {
        errors.media = [`A carousel takes at most ${MOST} slides.`];
    }

    answers.forEach((problems, index) => {
        for (const [key, messages] of Object.entries(problems)) {
            errors[key === "" ? `media.${index}` : `media.${index}.${key}`] = messages;
        }
    });

    return Object.keys(errors).length > 0 ? errors : null;
};
