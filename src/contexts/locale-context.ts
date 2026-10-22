import { createContext } from "react";

import { DEFAULT_LOCALE } from "../utils/format";

import type { Locale } from "../types";

// English by default, so a shared part such as the upload panel shows text outside a `FileManager` too.
export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
