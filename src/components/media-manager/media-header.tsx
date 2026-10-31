import type { Ref } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { startIconSx } from "../../styles/direction";
import { headerFieldSx, headerInputSx } from "../../styles/header-field";
import { HEADER_HEIGHT } from "../../styles/layout";
import { mediaMedium } from "../../styles/media-layout";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";

import type { MediaSection } from "../../types";

interface MediaHeaderProps {
    section: MediaSection | undefined;
    /** Whether there's more than one library, to choose among from a drawer where the list doesn't dock. */
    several: boolean;
    /** Whether that drawer is open. */
    librariesOpen: boolean;
    librariesOpenerRef: Ref<HTMLButtonElement>;
    onOpenLibraries: () => void;
    query: string;
    onQueryChange: (query: string) => void;
    /** Picks files to upload into the library; missing while it takes none. */
    onUpload: (() => void) | undefined;
    uploadRef: Ref<HTMLButtonElement>;
}

const headerSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    px: 1,
    pb: 0.75,
};

const barSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minHeight: HEADER_HEIGHT,
};

const titleSx: SxProps<Theme> = {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "40%",
    px: 1,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

// Opens the drawer of libraries, where the list doesn't dock; from `mediaMedium` it's docked.
const librariesButtonSx: SxProps<Theme> = {
    [mediaMedium]: { display: "none" },
};

const searchSx: SxProps<Theme> = {
    ...headerFieldSx,
    maxWidth: "32rem",
    marginInlineStart: "auto",
};

const uploadSx: SxProps<Theme> = {
    flexShrink: 0,
    ...startIconSx,
};

/**
 * Above the library: the button opening the libraries where they don't dock, its name, the search,
 * and Upload, while the library takes files.
 */
const MediaHeader = ({
    section,
    several,
    librariesOpen,
    librariesOpenerRef,
    onOpenLibraries,
    query,
    onQueryChange,
    onUpload,
    uploadRef,
}: MediaHeaderProps) => {
    const { text } = useLocale();

    return (
        <Box component="header" sx={headerSx}>
            <Box sx={barSx}>
                {several && (
                    <TooltipIconButton
                        ref={librariesOpenerRef}
                        label={text.mediaChooseLibrary}
                        sx={librariesButtonSx}
                        aria-expanded={librariesOpen}
                        onClick={onOpenLibraries}
                    >
                        <Icon name="menu" fontSize="small" />
                    </TooltipIconButton>
                )}
                <Typography component="h2" noWrap sx={titleSx}>
                    {section?.label}
                </Typography>
                <Box role="search" sx={searchSx}>
                    <Icon name="search" fontSize="small" />
                    <InputBase
                        type="search"
                        value={query}
                        placeholder={text.mediaSearch}
                        slotProps={{ input: { "aria-label": text.mediaSearch } }}
                        sx={headerInputSx}
                        onChange={(event) => onQueryChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && query) {
                                event.stopPropagation();
                                onQueryChange("");
                            }
                        }}
                    />
                    {query && (
                        <TooltipIconButton size="small" label={text.mediaClearSearch} onClick={() => onQueryChange("")}>
                            <Icon name="close" fontSize="small" />
                        </TooltipIconButton>
                    )}
                </Box>
                {onUpload && (
                    <Button
                        ref={uploadRef}
                        color="inherit"
                        startIcon={<Icon name="upload" fontSize="small" />}
                        sx={uploadSx}
                        onClick={onUpload}
                    >
                        {text.upload}
                    </Button>
                )}
            </Box>
        </Box>
    );
};

export default MediaHeader;
