import type { IconComponent } from "../../types";

/**
 * One shape of an icon on its 24 by 24 grid: a path's `d` alone, or a path or a circle (its centre
 * and radius) with what else it's drawn with, the fainter tone of a two-tone icon or holes cut by
 * the even-odd rule.
 */
export type IconShape =
    | string
    | { d: string; opacity?: number; evenOdd?: boolean }
    | { circle: readonly [x: number, y: number, radius: number]; opacity?: number; evenOdd?: boolean };

const draw = (shape: IconShape, index: number) => {
    if (typeof shape === "string") {
        return <path key={index} d={shape} />;
    }

    const fillRule = shape.evenOdd ? "evenodd" : undefined;

    if ("circle" in shape) {
        const [x, y, radius] = shape.circle;

        return <circle key={index} cx={x} cy={y} r={radius} opacity={shape.opacity} fillRule={fillRule} />;
    }

    return <path key={index} d={shape.d} opacity={shape.opacity} fillRule={fillRule} />;
};

/**
 * An icon of the built-in sets, from its shapes. It draws only: `Icon` sizes and mirrors it through
 * the class it passes, as it does a consumer's own.
 */
export const createIcon = (...shapes: IconShape[]): IconComponent => {
    const drawn = shapes.map(draw);

    return ({ children, ...props }) => (
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden {...props}>
            {children}
            {drawn}
        </svg>
    );
};
