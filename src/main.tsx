import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./components/main/app.tsx";
import Theme from "./components/main/theme.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme>
            <App />
        </Theme>
    </StrictMode>,
);
