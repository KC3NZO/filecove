import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app.tsx";
import MediaApp from "./media-app.tsx";
import { media } from "./options.ts";
import Theme from "./theme.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme>{media ? <MediaApp /> : <App />}</Theme>
    </StrictMode>,
);
