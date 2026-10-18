import { useState } from "react";

import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import type { SxProps, Theme } from "@mui/material/styles";

import { FileManager } from "../file-manager";
import { createDemoActions, sections, serverAdapter } from "./mock-data";

const appSx: SxProps<Theme> = {
    height: "100dvh",
};

const App = () => {
    const [notice, setNotice] = useState({ open: false, message: "" });
    const [actions] = useState(() => createDemoActions((message) => setNotice({ open: true, message })));

    return (
        <Box sx={appSx}>
            <FileManager adapter={serverAdapter} sections={sections} actions={actions} />
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
