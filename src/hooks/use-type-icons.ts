import { useEffect, useSyncExternalStore } from "react";

import { useIconConfig } from "./use-icon-config";

/** `@react-symbols/icons`' file and folder icons, chosen by name. */
export type TypeIcons = typeof import("@react-symbols/icons/utils");

// The coloured file and folder icons are a third of what an app would download with the component,
// every one of them, since which are needed is known only from the names shown. So they're a module
// of their own, loaded once for the page, the first time a root mounts or an icon is drawn, and the
// plain icons stand in until then. One load for every root: the module is the same for them all.
let loaded: TypeIcons | undefined;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

const loadTypeIcons = () => {
    loading ??= import("@react-symbols/icons/utils").then(
        (module) => {
            loaded = module;
            listeners.forEach((listener) => listener());
        },
        () => {
            // Offline or a chunk gone with a new deploy: the plain icons stay, and the next root or
            // icon to mount tries again.
            loading = undefined;
        },
    );
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

const getSnapshot = () => loaded;

// A server renders the plain icons, and so does hydration, the module coming after it.
const getServerSnapshot = () => undefined;

/**
 * Starts loading the coloured file and folder icons, unless `IconProvider` turned them off. Each
 * root calls it as it mounts, so they come while its first listing does, before anything shows
 * them; a part drawn outside a root (`MediaTile`, `MediaPicture`) starts it by drawing an icon.
 */
export const usePreloadTypeIcons = () => {
    const { typeIcons } = useIconConfig();

    useEffect(() => {
        if (typeIcons && !loaded) {
            loadTypeIcons();
        }
    }, [typeIcons]);
};

/** The coloured file and folder icons once they've loaded, or `undefined` for the plain ones. */
export const useTypeIcons = (): TypeIcons | undefined => {
    const { typeIcons } = useIconConfig();
    const icons = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    usePreloadTypeIcons();

    return typeIcons ? icons : undefined;
};
