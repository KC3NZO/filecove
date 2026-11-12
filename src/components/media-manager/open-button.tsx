import { useLocale } from "../../hooks/use-locale";
import { isolate } from "../../utils/bidi";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";

interface OpenButtonProps {
    name: string;
    /** Whether it's a group's, opening its details. */
    group: boolean;
    index: number;
    onOpen: (index: number) => void;
    className?: string;
}

/**
 * A tile's or a row's button opening its asset in the library's place. Out of the Tab order and
 * hidden from screen readers, as the file manager's ⋮ is, since Alt+Enter on the asset does the
 * same; a click on it neither selects nor chooses.
 */
const OpenButton = ({ name, group, index, onOpen, className }: OpenButtonProps) => {
    const { text } = useLocale();

    return (
        <TooltipIconButton
            size="small"
            tabIndex={-1}
            aria-hidden
            label={group ? text.mediaGroupDetails(isolate(name)) : text.mediaOpenAsset(isolate(name))}
            className={className}
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
