import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { MediaFields } from "../src";
import { ResponsivePicture } from "./media-assets";
import { coverField, galleryField, posterField, teaserField } from "./media-relation";

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
// details opening next, to try both. A cover is a picture of Images and a teaser a video of Videos,
// each chosen through `MediaPicker` and kept as the asset, which the backend hands back as it is now.

const previewSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    p: 1,
    borderRadius: 2,
    bgcolor: "action.hover",
};

const previewCoverSx: SxProps<Theme> = { width: 72, height: 72, borderRadius: 1.5 };

const previewNameSx: SxProps<Theme> = { fontWeight: 700, overflowWrap: "anywhere" };

const previewTypeSx: SxProps<Theme> = { color: "text.secondary", fontSize: "0.8125rem" };

/**
 * How the group will look, following the form as it's filled in: its cover drawn by the picture's own
 * sizes, and its name and type as they're typed.
 */
const GroupPreview = ({ values }: MediaGroupFormParams) => (
    <Box sx={previewSx}>
        <ResponsivePicture entry={values.cover as FileEntry | undefined} sizes="72px" sx={previewCoverSx} />
        <div>
            <Typography sx={previewNameSx}>
                <bdi>{String(values.name ?? "").trim() || "Untitled"}</bdi>
            </Typography>
            <Typography sx={previewTypeSx}>{String(values.type ?? "")}</Typography>
        </div>
    </Box>
);

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
 * Its fields, following each other: a cover from Images for any, a Season or an Album has a date, and
 * a Series a teaser from Videos and a poster and a gallery from Images, each going when the type's
 * changed.
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
                coverField,
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
            <GroupPreview {...form} />
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
