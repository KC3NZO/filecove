import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app.tsx";
import Theme from "./theme.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme>
            <App />
        </Theme>
    </StrictMode>,
);
