import { useState } from "react";

import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import type { SxProps, Theme } from "@mui/material/styles";

import { FileManager } from "../src";
import { createDemoActions, sections, serverAdapter } from "./mocks/mock-data";

const appSx: SxProps<Theme> = {
    height: "100dvh",
};

// `?single` in the URL shows the file manager with one section, whose folders fill the sidebar.
const single = new URLSearchParams(window.location.search).has("single");

const App = () => {
    const [notice, setNotice] = useState({ open: false, message: "" });
    const [actions] = useState(() => createDemoActions((message) => setNotice({ open: true, message })));

    return (
        <Box sx={appSx}>
            {single ? (
                <FileManager adapter={serverAdapter} section={sections[0].sections[0]} actions={actions} />
            ) : (
                <FileManager adapter={serverAdapter} sections={sections} actions={actions} />
            )}
            <Snackbar
                open={notice.open}
                message={notice.message}
                autoHideDuration={3000}
                onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
            />
        </Box>
    );
};

export default App;
