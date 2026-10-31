import type { FieldErrors, FileEntry, PropertyDefinition, PropertyDefinitionGroup } from "../types";

/** No errors: what the properties hand their definitions, and a media manager without `errors`. */
export const NO_ERRORS: FieldErrors = Object.freeze({});

const NO_MESSAGES: readonly string[] = [];

/** The messages under one key of a backend's errors, one or several as it answered them; none when there are none. */
export const messagesAt = (errors: FieldErrors, key: string): readonly string[] => {
    const found = Object.hasOwn(errors, key) ? errors[key] : undefined;

    if (typeof found === "string") {
        return found === "" ? NO_MESSAGES : [found];
    }

    return found ? found.filter((message) => typeof message === "string" && message !== "") : NO_MESSAGES;
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

    return messagesAt(errors, definition.errorKey({ index, entry }));
};

/** How many of one pick's fields have an error their `errorKey` finds, for its row. */
export const countFieldErrors = (
    groups: readonly PropertyDefinitionGroup[],
    errors: FieldErrors,
    index: number,
    entry: FileEntry,
) => {
    if (errors === NO_ERRORS) {
        return 0;
    }

    let count = 0;

    for (const group of groups) {
        for (const definition of group.properties) {
            if (fieldMessages(definition, errors, index, entry).length > 0) {
                count++;
            }
        }
    }

    return count;
};
