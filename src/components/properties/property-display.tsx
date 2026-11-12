import { useLocale } from "../../hooks/use-locale";
import { formatItem, safeHref } from "../../utils/property-value";
import Chip from "../ui/chip";
import Link from "../ui/link";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./property-display.module.css";

import type { PropertyDefinition } from "../../types";

export interface PropertyDisplayProps {
    definition: PropertyDefinition;
    value: unknown;
    /** Its text, as `formatValue` writes it. */
    formattedValue: string;
}

interface UrlProps {
    value: unknown;
    label: string;
}

/** A link opening in a new tab, or only its text when it's no address a page may open. */
const Url = ({ value, label }: UrlProps) => {
    const href = safeHref(value);

    return href ? (
        <Link href={href} target="_blank" rel="noopener noreferrer">
            <bdi>{label}</bdi>
        </Link>
    ) : (
        <bdi>{label}</bdi>
    );
};

/**
 * A property of the app's definition shown as its type has it: its text, a list as chips, an
 * address as a link. One with a `valueFormatter` is its text, as the app wrote it. Public, so a
 * property's `render` adding a little to how it's shown needn't draw it again:
 * `<PropertyDisplay {...params} />`.
 */
const PropertyDisplay = ({ definition, value, formattedValue }: PropertyDisplayProps) => {
    const locale = useLocale();
    const url = definition.type === "string" && definition.kind === "url";

    if (definition.valueFormatter) {
        return <bdi>{formattedValue}</bdi>;
    }

    if (Array.isArray(value)) {
        return url ? (
            <div className={cx(styles.links, fmClasses.propertyDisplay)}>
                {value.map((item) => (
                    <Url key={String(item)} value={item} label={formatItem(definition, item, locale)} />
                ))}
            </div>
        ) : (
            <div className={cx(styles.tags, fmClasses.propertyDisplay)}>
                {value.map((item) => (
                    <Chip key={String(item)} label={<bdi>{formatItem(definition, item, locale)}</bdi>} />
                ))}
            </div>
        );
    }

    return url ? <Url value={value} label={formattedValue} /> : <bdi>{formattedValue}</bdi>;
};

export default PropertyDisplay;
