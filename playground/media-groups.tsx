import { useState } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaFields } from "../src";
import { galleryField, posterField, teaserField } from "./media-relation";
import { coverUrl } from "./mocks/mock-media";

import type {
    FileEntry,
    MediaGroupForm,
    MediaGroupFormParams,
    MediaGroupTarget,
    PropertyDefinition,
    PropertyDefinitionGroup,
} from "../src";

// Audio's group form, the playground's own: what a group is and has is this backend's, and the media
// manager reads none of it. Images and Videos have none, so they make a group from a name alone, its
// details opening next, to try both.

const COVERS = ["harbour-dawn", "forest-path", "desert-noon", "city-night", "lake-sunrise", "glacier-blue"];

const pickerSx: SxProps<Theme> = { display: "flex", flexDirection: "column", gap: 1.5 };

const previewSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    p: 1,
    borderRadius: 2,
    bgcolor: "action.hover",
};

const previewCoverSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 72,
    height: 72,
    borderRadius: 1.5,
    overflow: "hidden",
    bgcolor: "action.selected",
    color: "text.secondary",
    fontSize: "0.75rem",
    "& > img": { width: "100%", height: "100%", objectFit: "cover" },
};

const previewNameSx: SxProps<Theme> = { fontWeight: 700, overflowWrap: "anywhere" };

const previewTypeSx: SxProps<Theme> = { color: "text.secondary", fontSize: "0.8125rem" };

const coversLabelSx: SxProps<Theme> = { color: "text.secondary", fontSize: "0.75rem" };

const coversSx: SxProps<Theme> = { display: "flex", flexWrap: "wrap", gap: 1 };

const coverSx: SxProps<Theme> = {
    width: 56,
    height: 56,
    borderRadius: 1.5,
    overflow: "hidden",
    bgcolor: "action.hover",
    color: "text.secondary",
    fontSize: "0.75rem",
    outline: "2px solid transparent",
    outlineOffset: 1,
    "& > img": { width: "100%", height: "100%", objectFit: "cover" },
    '&[aria-checked="true"]': { outlineColor: (theme) => (theme.vars || theme).palette.primary.main },
    "&.Mui-focusVisible": { outlineColor: (theme) => (theme.vars || theme).palette.text.primary },
};

/**
 * A component entirely the playground's, in the form as anything can be: covers to pick from, the form
 * holding the one picked under `cover`, and how the group will look, following the name and type as
 * they're typed, and a cover the pointer or the focus is on, which only this component's state knows.
 */
const CoverPicker = ({ values, setValues, sending }: MediaGroupFormParams) => {
    const [trying, setTrying] = useState<string | null>(null);
    const picked = typeof values.cover === "string" ? values.cover : "";
    const shown = trying ?? picked;
    // One it has from before keeps its place among the others.
    const covers = picked && !COVERS.includes(picked) ? [picked, ...COVERS] : COVERS;
    const pick = (cover: string) => setValues((held) => ({ ...held, cover }));

    return (
        <Box sx={pickerSx}>
            <Box sx={previewSx}>
                <Box sx={previewCoverSx}>
                    {shown ? <img src={coverUrl(shown)} alt="" draggable={false} /> : "No cover"}
                </Box>
                <div>
                    <Typography sx={previewNameSx}>
                        <bdi>{String(values.name ?? "").trim() || "Untitled"}</bdi>
                    </Typography>
                    <Typography sx={previewTypeSx}>{String(values.type ?? "")}</Typography>
                </div>
            </Box>
            <Typography id="group-cover-label" sx={coversLabelSx}>
                Cover
            </Typography>
            <Box
                role="radiogroup"
                aria-labelledby="group-cover-label"
                sx={coversSx}
                onMouseLeave={() => setTrying(null)}
                onBlur={() => setTrying(null)}
            >
                <ButtonBase
                    role="radio"
                    aria-checked={!picked}
                    disabled={sending}
                    sx={coverSx}
                    onMouseEnter={() => setTrying("")}
                    onFocus={() => setTrying("")}
                    onClick={() => pick("")}
                >
                    None
                </ButtonBase>
                {covers.map((cover) => (
                    <ButtonBase
                        key={cover}
                        role="radio"
                        aria-checked={cover === picked}
                        aria-label={cover}
                        disabled={sending}
                        sx={coverSx}
                        onMouseEnter={() => setTrying(cover)}
                        onFocus={() => setTrying(cover)}
                        onClick={() => pick(cover)}
                    >
                        <img src={coverUrl(cover)} alt="" draggable={false} />
                    </ButtonBase>
                ))}
            </Box>
        </Box>
    );
};

/** What can be made in a group, by what it is: a series holds seasons, a collection albums. */
const typesIn = (parent: FileEntry | null) =>
    parent?.meta?.type === "Series"
        ? ["Season"]
        : parent?.meta?.type === "Collection"
          ? ["Album"]
          : ["Series", "Collection"];

/** Only what's released as one has a release date. */
const isReleased = (type: unknown) => type === "Season" || type === "Album";

/**
 * Its fields, following each other: a Season or an Album has a date, and a Series a teaser from Videos
 * and a poster and a gallery from Images, each going when the type's changed.
 */
const GroupFields = (form: MediaGroupFormParams) => {
    const { values, parent, group } = form;
    const name: PropertyDefinition = {
        field: "name",
        label: "Name",
        type: "string",
        required: true,
        errorKey: () => "name",
    };
    const type: PropertyDefinition = {
        field: "type",
        label: "Type",
        type: "string",
        options: (group ? ["Series", "Season", "Collection", "Album"] : typesIn(parent)).map((each) => ({
            value: each,
            label: each,
        })),
    };
    const groups: PropertyDefinitionGroup[] = [
        {
            id: "about",
            properties: [
                name,
                type,
                ...(isReleased(values.type)
                    ? [{ field: "released", label: "Released", type: "date" } satisfies PropertyDefinition]
                    : []),
                ...(values.type === "Series" ? [teaserField, posterField, galleryField] : []),
                { field: "description", label: "Description", type: "string", multiline: true },
            ],
        },
    ];

    return (
        <>
            <CoverPicker {...form} />
            <MediaFields
                {...form}
                groups={groups}
                setValues={(next) => {
                    const { released, teaser, poster, gallery, ...rest } = next;

                    form.setValues({
                        ...rest,
                        ...(isReleased(next.type) ? { released } : {}),
                        ...(next.type === "Series" ? { teaser, poster, gallery } : {}),
                    });
                }}
            />
        </>
    );
};

/** A library's group form: its title by where it's made, or which group's edited, and what it starts from. */
export const groupForm = ({ group, parent }: MediaGroupTarget): MediaGroupForm => {
    const types = typesIn(parent);

    return {
        title: group
            ? `Edit “${group.name}”`
            : types.length === 1
              ? `New ${types[0].toLowerCase()}`
              : "New series or collection",
        defaults: { name: "", type: types[0] },
        load: ({ group: edited, adapter }, { signal }) =>
            adapter.properties?.(edited, { signal }).then(({ values }) => ({ ...values })) ?? Promise.resolve({}),
        ready: ({ values }) =>
            !String(values.name ?? "").trim()
                ? "Give it a name first."
                : values.type === "Album" && !values.cover
                  ? "An album needs a cover."
                  : true,
        render: (form) => <GroupFields {...form} />,
    };
};
