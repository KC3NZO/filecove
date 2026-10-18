import { createTheme } from "@mui/material/styles";

// GNOME Files flavour for the dev host. The file manager only reads palette tokens
// (background.default for the window and sidebar, background.paper for the content panel,
// primary for selection), so a consumer's own theme restyles it without code changes.
const theme = createTheme({
    cssVariables: true,
    colorSchemes: {
        light: {
            palette: {
                primary: { main: "#1a7f96" },
                background: { default: "#ebebef", paper: "#ffffff" },
            },
        },
        dark: {
            palette: {
                primary: { main: "#27a1b9" },
                background: { default: "#1a1b26", paper: "#22232e" },
                text: { primary: "#c6c7cf", secondary: "#8b8c96" },
                divider: "#33343e",
            },
        },
    },
    typography: {
        // The desktop's own UI font: Ubuntu on Ubuntu, Cantarell or Adwaita Sans on GNOME.
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Ubuntu, Cantarell, sans-serif',
    },
    components: {
        MuiButtonBase: {
            defaultProps: { disableRipple: true },
        },
        MuiButton: {
            styleOverrides: {
                root: { textTransform: "none" },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "&.Mui-focusVisible": {
                        outline: `2px solid ${(theme.vars || theme).palette.primary.main}`,
                        outlineOffset: -2,
                    },
                }),
            },
        },
    },
});

export default theme;
