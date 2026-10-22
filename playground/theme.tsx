import type { PropsWithChildren } from "react";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { prefixer } from "stylis";
import stylisRtl from "stylis-plugin-rtl";

import { muiRtl, rtl } from "./options";
import theme from "./styles/theme";

// Emotion's cache for `?rtl=mui`, as MUI's guide makes it: its default prefixer, then the RTL plugin.
const rtlCache = createCache({ key: "muirtl", stylisPlugins: [prefixer, stylisRtl] });

if (rtl) {
    document.documentElement.dir = "rtl";
}

const Theme = ({ children }: PropsWithChildren) => {
    const themed = (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );

    return muiRtl ? <CacheProvider value={rtlCache}>{themed}</CacheProvider> : themed;
};

export default Theme;
