import type { FieldErrors, MediaChoice } from "../../src";

// The playground's stand-in for the app's own backend, which the picks are saved to, as a product's
// carousel would be: sent as `items`, in the order set, and checked as a Laravel form request would
// check them, answering a 422's `errors`, by its own keys (`items.0.alt.en`), a list of messages
// each. The media manager never sees this: the app hands what comes back to its `errors`.

const has = (value: unknown) => value !== undefined && value !== null && value !== "";

/** What one pick fails, under its own keys, without the `items.N.` the request puts before them. */
const problemsOf = ({ asset, section, values }: MediaChoice): Record<string, string[]> => {
    const problems: Record<string, string[]> = {};

    if (section.kind === "image") {
        if (!values.decorative && !has(values["alt.en"])) {
            problems["alt.en"] = ["The English alt text is required unless the picture is decorative."];
        }

        if (values.fit === "contain" && has(values.focus) && values.focus !== "center") {
            problems.focus = ["The focal point is only used when the picture fills the slide."];
        }
    }

    if (section.kind === "video") {
        if (!has(values["title.en"])) {
            problems["title.en"] = ["The English title is required."];
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
export const savePicks = (choices: readonly MediaChoice[]): Promise<FieldErrors | null> =>
    new Promise((resolve) => {
        setTimeout(() => {
            const errors: Record<string, string[]> = {};

            choices.forEach((choice, index) => {
                for (const [key, messages] of Object.entries(problemsOf(choice))) {
                    errors[`items.${index}.${key}`] = messages;
                }
            });

            resolve(Object.keys(errors).length > 0 ? errors : null);
        }, 400);
    });
