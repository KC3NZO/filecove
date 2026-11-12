import type { MouseEvent } from "react";

import { useLocale } from "../../hooks/use-locale";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";

interface GroupCheckProps {
    index: number;
    onCheck: (index: number, event: MouseEvent) => void;
    className?: string;
}

/**
 * A group's own check, where a group can be selected: a click on the group goes in, so this is what
 * selects it. Out of the Tab order and hidden from screen readers, as its Open button is, since Space on
 * the group does the same, which its `option` says by being selected or not.
 */
const GroupCheck = ({ index, onCheck, className }: GroupCheckProps) => {
    const { text } = useLocale();

    return (
        <TooltipIconButton
            size="small"
            tabIndex={-1}
            aria-hidden
            label={text.mediaSelectAsset}
            className={className}
            onClick={(event) => {
                event.stopPropagation();
                onCheck(index, event);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
        >
            <Icon name="check" />
        </TooltipIconButton>
    );
};

export default GroupCheck;
