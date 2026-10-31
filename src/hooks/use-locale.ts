import { useContext, useState } from "react";

import { LocaleContext } from "../contexts/locale-context";
import { createLocale } from "../utils/format";

import type { LocaleText } from "../types";

type GivenText = Partial<LocaleText> | undefined;

/** The text and formats to show, from `LocaleContext`. */
export const useLocale = () => useContext(LocaleContext);

// Whether two `localeText`s hold the same texts, so one written inline, a new object each render,
// isn't taken for a change.
const sameTexts = (a: GivenText, b: GivenText) => {
    if (a === b) {
        return true;
    }

    if (!a || !b) {
        return false;
    }

    const keys = Object.keys(a) as (keyof LocaleText)[];

    return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/**
 * The locale `FileManager` and `MediaManager` provide, made afresh only when a text or `locale`
 * changes, since every row rendered reads it and renders again with a new one.
 */
export const useLocaleValue = (localeText: GivenText, locale: string | undefined) => {
    const [cached, setCached] = useState(() => ({ localeText, locale, value: createLocale(localeText, locale) }));

    if (cached.locale === locale && sameTexts(cached.localeText, localeText)) {
        return cached.value;
    }

    // Set during render, as React does for state that follows props, so nothing renders with the old one.
    const next = { localeText, locale, value: createLocale(localeText, locale) };

    setCached(next);

    return next.value;
};
