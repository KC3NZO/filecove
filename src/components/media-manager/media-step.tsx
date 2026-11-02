import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { focusOutline } from "../../styles/mixins";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";

interface MediaStepProps {
    title: string;
    /** The back button's name. */
    backLabel: string;
    /** Back, or Escape. */
    onBack: () => void;
    /** Its buttons, at its foot. */
    footer: ReactNode;
    children: ReactNode;
}

// Over the library, in its place, as the asset view is, what's under it kept as it was.
const rootSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    bgcolor: "background.paper",
    outline: "none",
    "&:focus-visible": { ...focusOutline, borderRadius: "inherit" },
};

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    flexShrink: 0,
    minHeight: 52,
    paddingInlineStart: 0.5,
    paddingInlineEnd: 1.5,
    borderBottom: 1,
    borderColor: "divider",
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    px: 0.5,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const bodySx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
};

// A column of a form's width, in the middle of the library's room.
const columnSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    maxWidth: "36rem",
    marginInline: "auto",
    px: 2,
    py: 2,
};

const footerSx: SxProps<Theme> = {
    display: "flex",
    justifyContent: "flex-end",
    gap: 1,
    flexShrink: 0,
    p: 1.5,
    borderTop: 1,
    borderColor: "divider",
};

/**
 * A step in the library's place, as a picker is often in the app's own dialog already: back, a title,
 * a column of a form's width and its buttons at the foot. It takes the focus as it opens, so it's read
 * out by its title, and Escape goes back.
 */
const MediaStep = ({ title, backLabel, onBack, footer, children }: MediaStepProps) => {
    const titleId = useId();
    const rootRef = useRef<HTMLElement>(null);

    useEffect(() => rootRef.current?.focus(), []);

    return (
        <Box
            component="section"
            ref={rootRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            sx={rootSx}
            onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    onBack();
                }
            }}
        >
            <Box sx={headerSx}>
                <TooltipIconButton label={backLabel} onClick={onBack}>
                    <Icon name="arrowBack" fontSize="small" />
                </TooltipIconButton>
                <Typography id={titleId} component="h2" noWrap sx={titleSx}>
                    {title}
                </Typography>
            </Box>
            <Box sx={bodySx}>
                <Box sx={columnSx}>{children}</Box>
            </Box>
            <Box sx={footerSx}>{footer}</Box>
        </Box>
    );
};

export default MediaStep;
