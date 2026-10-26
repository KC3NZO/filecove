import { useEffect, useRef } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

interface FindLayerProps {
    /** The names to find, by the index of the row each is for: a folder's entries, the tree's rows. */
    names: readonly string[];
    /** Called with the index of the name the browser's find in page has come to. */
    onFound: (index: number) => void;
}

interface DrawnNameProps {
    name: string;
}

/**
 * Whether the browser finds text that's `hidden="until-found"`, and tells the page as it does
 * (`beforematch`). Where it doesn't, names are written in the rows, as nothing else would find them.
 */
const FINDS_HIDDEN = typeof HTMLElement !== "undefined" && "onbeforematch" in HTMLElement.prototype;

/** Names per block of the layer, each block hidden as a whole, so the browser lays out a block, not a name. */
const BLOCK = 256;

/** How long one go at building the layer runs before giving the page back, in ms. */
const SLICE = 8;

// A pixel tall at the panel's top, however far it's scrolled, so what the browser finds in it is
// in view already and the browser doesn't scroll to it: the view scrolls to the row instead. The
// names in it are a pixel high, clipped and see-through, so nothing of them shows. It takes no room.
const layerSx: SxProps<Theme> = {
    position: "sticky",
    top: 0,
    flexShrink: 0,
    height: "1px",
    mb: "-1px",
    overflow: "hidden",
    fontSize: "1px",
    lineHeight: "1px",
    whiteSpace: "nowrap",
    opacity: 0,
    pointerEvents: "none",
    // A page's own styles hiding every `[hidden]`, as some resets do, would keep the names from
    // the browser's find, which only looks in what's hidden until found.
    "& [hidden]": { display: "block !important" },
};

// Written by CSS, which the browser's find doesn't look in, so each name is found once, in the
// find layer. It runs and lines up as its own letters do, as a `<bdi>` would.
const drawnSx: SxProps<Theme> = {
    unicodeBidi: "plaintext",
    "&::before": { content: "attr(data-name)" },
};

const hideUntilFound = (element: Element) => element.setAttribute("hidden", "until-found");

/** Whether `names` has from `from` to `to` what `held` has there. */
const holds = (held: readonly string[], names: readonly string[], from: number, to: number) => {
    for (let index = from; index < to; index += 1) {
        if (held[index] !== names[index]) {
            return false;
        }
    }

    return true;
};

/**
 * Makes the layer's block of names from `from` to `to` hold them: one element per name, each
 * hidden until found inside the block, which is too, so the browser tells which one it found.
 */
const fill = (block: Element, names: readonly string[], from: number, to: number) => {
    for (let index = from; index < to; index += 1) {
        let item = block.children[index - from];

        if (!item) {
            item = document.createElement("div");
            hideUntilFound(item);
            item.setAttribute("data-index", String(index));
            block.append(item);
        }

        if (item.textContent !== names[index]) {
            item.textContent = names[index];
        }
    }

    while (block.children.length > to - from) {
        block.lastElementChild?.remove();
    }
};

/**
 * Every row's name, for the browser's find in page, when the view renders only the rows in or near
 * view (see `virtualization.md`). The names are `hidden="until-found"`, which the browser's find
 * looks in, telling the page what it came to (`beforematch`) before it shows it: the layer hides
 * it again, so the next is found the same way, and hands the view its index, for the view to
 * scroll to the row, give it the Tab stop, and highlight it for a moment, as the browser's own
 * highlight is in the layer, where it doesn't show. The rows draw their names with `DrawnName`, so
 * each is found once, in the rows' order.
 *
 * The layer is built outside React, as React writes `hidden` as true or false only, in goes of a
 * few ms so a folder of thousands doesn't hold the page up, and only blocks whose names changed
 * are built again. It's hidden from screen readers, which hear the rows.
 */
const FindLayer = ({ names, onFound }: FindLayerProps) => {
    const layerRef = useRef<HTMLDivElement>(null);
    // The names the layer holds, by index, as it's built.
    const held = useRef<string[]>([]);
    const found = useRef(onFound);

    useEffect(() => {
        found.current = onFound;
    });

    useEffect(() => {
        const layer = layerRef.current;

        if (!layer) {
            return;
        }

        const blocks = Math.ceil(names.length / BLOCK);
        let next = 0;
        let timer = 0;

        const build = () => {
            const until = performance.now() + SLICE;

            for (; next < blocks && performance.now() < until; next += 1) {
                const from = next * BLOCK;
                const to = Math.min(from + BLOCK, names.length);
                let block = layer.children[next];

                if (block && block.children.length === to - from && holds(held.current, names, from, to)) {
                    continue;
                }

                if (!block) {
                    block = document.createElement("div");
                    hideUntilFound(block);
                    layer.append(block);
                }

                fill(block, names, from, to);

                for (let index = from; index < to; index += 1) {
                    held.current[index] = names[index];
                }
            }

            if (next < blocks) {
                timer = window.setTimeout(build);

                return;
            }

            while (layer.children.length > blocks) {
                layer.lastElementChild?.remove();
            }

            held.current.length = names.length;
        };

        build();

        return () => window.clearTimeout(timer);
    }, [names]);

    useEffect(() => {
        const layer = layerRef.current;

        if (!layer) {
            return;
        }

        const timers = new Set<number>();

        // Fired at the name found, then at its block, before the browser shows them. Once it has,
        // and has scrolled to it, they're hidden again and the view goes to the row.
        const handleBeforeMatch = (event: Event) => {
            const item = event.target;

            if (!(item instanceof HTMLElement) || item.dataset.index === undefined) {
                return;
            }

            const index = Number(item.dataset.index);
            const timer = window.setTimeout(() => {
                timers.delete(timer);
                hideUntilFound(item);

                if (item.parentElement && item.parentElement !== layer) {
                    hideUntilFound(item.parentElement);
                }

                found.current(index);
            });

            timers.add(timer);
        };

        layer.addEventListener("beforematch", handleBeforeMatch, true);

        return () => {
            layer.removeEventListener("beforematch", handleBeforeMatch, true);
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, []);

    if (!FINDS_HIDDEN) {
        return null;
    }

    return <Box ref={layerRef} sx={layerSx} aria-hidden />;
};

/**
 * A row's name, drawn rather than written where the browser finds names in a `FindLayer`, so it
 * isn't found twice; screen readers still read it. Written in a `<bdi>` elsewhere.
 */
export const DrawnName = ({ name }: DrawnNameProps) =>
    FINDS_HIDDEN ? <Box component="span" sx={drawnSx} data-name={name} /> : <bdi>{name}</bdi>;

export default FindLayer;
