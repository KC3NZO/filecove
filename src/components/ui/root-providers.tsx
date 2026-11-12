import type { ReactNode } from "react";

import { DirectionProvider } from "@base-ui/react/direction-provider";

import { DirectionContext } from "../../contexts/direction-context";
import { usePreloadTypeIcons } from "../../hooks/use-type-icons";
import { TooltipProvider } from "./tooltip";

import type { TextDirection } from "../../types";

interface RootProvidersProps {
    /** The root's direction, read from the page, or undefined before it's known. */
    direction: TextDirection | undefined;
    children: ReactNode;
}

/**
 * What every root gives the parts under it: its direction, for the menus, dialogs, tooltips and
 * drag image it portals to `<body>`, which take it as their `dir` (`DirectionContext`), and for
 * Base UI's own parts, whose keys and sides follow it (`DirectionProvider`); and one group for its
 * tooltips, so the next shows at once while the pointer moves along a row of buttons. It also starts
 * loading the coloured file and folder icons as the root mounts, while its first listing comes.
 */
const RootProviders = ({ direction, children }: RootProvidersProps) => {
    usePreloadTypeIcons();

    return (
        <DirectionContext value={direction}>
            <DirectionProvider direction={direction ?? "ltr"}>
                <TooltipProvider>{children}</TooltipProvider>
            </DirectionProvider>
        </DirectionContext>
    );
};

export default RootProviders;
