import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";

interface OpenButtonProps {
    name: string;
    index: number;
    onOpen: (index: number) => void;
    sx?: SxProps<Theme>;
}

/**
 * A tile's or a row's button opening its asset in the library's place. Out of the Tab order and
 * hidden from screen readers, as the file manager's ⋮ is, since Alt+Enter on the asset does the
 * same; a click on it neither selects nor chooses.
 */
const OpenButton = ({ name, index, onOpen, sx }: OpenButtonProps) => {
    const { text } = useLocale();

    return (
        <TooltipIconButton
            size="small"
            tabIndex={-1}
            aria-hidden
            label={text.mediaOpenAsset(isolate(name))}
            sx={sx}
            onClick={(event) => {
                event.stopPropagation();
                onOpen(index);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
        >
            <Icon name="info" />
        </TooltipIconButton>
    );
};

export default OpenButton;
