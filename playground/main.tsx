import "./theme.ts";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app.tsx";
import MediaApp from "./media-app.tsx";
import { media } from "./options.ts";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        {media ? <MediaApp /> : <App />}
    </StrictMode>,
);
