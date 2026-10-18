import type { PropsWithChildren } from "react";

import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";

import theme from "../styles/theme";

const Theme = ({ children }: PropsWithChildren) => {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
};

export default Theme;
