import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { formatItem, safeHref } from "../../utils/property-value";

import type { PropertyDefinition } from "../../types";

interface PropertyDisplayProps {
    definition: PropertyDefinition;
    value: unknown;
    /** Its text, as `formatValue` writes it. */
    formattedValue: string;
}

interface UrlProps {
    value: unknown;
    label: string;
}

const tagsSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    gap: 0.5,
};

const linksSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.25,
    minWidth: 0,
};

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
 * address as a link. One with a `valueFormatter` is its text, as the app wrote it.
 */
const PropertyDisplay = ({ definition, value, formattedValue }: PropertyDisplayProps) => {
    const locale = useLocale();
    const url = definition.type === "string" && definition.kind === "url";

    if (definition.valueFormatter) {
        return <bdi>{formattedValue}</bdi>;
    }

    if (Array.isArray(value)) {
        return url ? (
            <Box sx={linksSx}>
                {value.map((item) => (
                    <Url key={String(item)} value={item} label={formatItem(definition, item, locale)} />
                ))}
            </Box>
        ) : (
            <Box sx={tagsSx}>
                {value.map((item) => (
                    <Chip key={String(item)} size="small" label={<bdi>{formatItem(definition, item, locale)}</bdi>} />
                ))}
            </Box>
        );
    }

    return url ? <Url value={value} label={formattedValue} /> : <bdi>{formattedValue}</bdi>;
};

export default PropertyDisplay;
