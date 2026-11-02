import type { FieldErrors, FileEntry, PropertyDefinition, PropertyErrorKeyParams } from "../types";

/** No errors: what the properties hand their definitions, and a media manager without `errors`. */
export const NO_ERRORS: FieldErrors = Object.freeze({});

export const NO_MESSAGES: readonly string[] = [];

/** Where errors are, as an `errorKey` or `choiceErrorKey` names them: the backend's key, or several. */
type ErrorKeys = string | readonly string[];

/** The messages under one key of a backend's errors, one or several as it answered them; none when there are none. */
export const messagesAt = (errors: FieldErrors, key: string): readonly string[] => {
    const found = Object.hasOwn(errors, key) ? errors[key] : undefined;

    if (typeof found === "string") {
        return found === "" ? NO_MESSAGES : [found];
    }

    return found ? found.filter((message) => typeof message === "string" && message !== "") : NO_MESSAGES;
};

/**
 * The messages under one key or several, in the keys' order, each once, as two languages' fields
 * may be answered the same words.
 */
const messagesUnder = (errors: FieldErrors, keys: ErrorKeys): readonly string[] => {
    if (typeof keys === "string") {
        return messagesAt(errors, keys);
    }

    const found = [...new Set(keys.flatMap((key) => messagesAt(errors, key)))];

    return found.length > 0 ? found : NO_MESSAGES;
};

/** One pick's field's messages, found by its `errorKey`; none without one. */
export const fieldMessages = (
    definition: PropertyDefinition,
    errors: FieldErrors,
    index: number,
    entry: FileEntry,
): readonly string[] => {
    if (!definition.errorKey || errors === NO_ERRORS) {
        return NO_MESSAGES;
    }

    return messagesUnder(errors, definition.errorKey({ index, entry }));
};

/** One pick's own messages, about it as a whole rather than one of its fields, found by `choiceErrorKey`. */
export const choiceMessages = (
    choiceErrorKey: ((params: PropertyErrorKeyParams) => ErrorKeys) | undefined,
    errors: FieldErrors,
    index: number,
    entry: FileEntry,
): readonly string[] => {
    if (!choiceErrorKey || errors === NO_ERRORS) {
        return NO_MESSAGES;
    }

    return messagesUnder(errors, choiceErrorKey({ index, entry }));
};

/**
 * How many of a pick's fields have a message, as its form names them now (`MediaPickForm.errorKeys`),
 * one entry a field, so a title with an error in two languages counts once.
 */
export const countErrorsAt = (errors: FieldErrors, fields: readonly ErrorKeys[]) =>
    fields.filter((keys) => messagesUnder(errors, keys).length > 0).length;

/**
 * What a form's refusal says (`MediaFormRefusal`): its message, or `fallback`, which always shows, as
 * no field may name a key it has, and what's under its fields, by the backend's keys.
 */
export const refusalOf = (error: unknown, fallback: string) => {
    const message = (error instanceof Error && error.message) || fallback;
    const found = typeof error === "object" && error !== null ? (error as { errors?: unknown }).errors : undefined;

    return {
        message,
        errors: typeof found === "object" && found !== null ? (found as FieldErrors) : NO_ERRORS,
    };
};
