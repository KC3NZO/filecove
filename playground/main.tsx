import "./theme.ts";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { IconProvider } from "../src";
import type { IconSet } from "../src";
// The package's `icons/<style>`, every one of them, since the playground switches between them.
import { filledIcons } from "../src/icon-sets/filled";
import { outlinedIcons } from "../src/icon-sets/outlined";
import { roundedIcons } from "../src/icon-sets/rounded";
import { sharpIcons } from "../src/icon-sets/sharp";
import { twoToneIcons } from "../src/icon-sets/two-tone";
import App from "./app.tsx";
import MediaApp from "./media-app.tsx";
import { iconStyle, media, plainIcons } from "./options.ts";

const ICON_STYLES: Record<string, IconSet> = {
    filled: filledIcons,
    outlined: outlinedIcons,
    rounded: roundedIcons,
    sharp: sharpIcons,
    "two-tone": twoToneIcons,
};

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <IconProvider icons={iconStyle ? ICON_STYLES[iconStyle] : undefined} typeIcons={!plainIcons}>
            {media ? <MediaApp /> : <App />}
        </IconProvider>
    </StrictMode>,
);
