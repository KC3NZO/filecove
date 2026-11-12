import { MediaFields } from "../src";
import { ResponsivePicture } from "./media-assets";
import { coverField, galleryField, posterField, teaserField } from "./media-relation";
import { Text } from "./ui";
import styles from "./media-groups.module.css";

import type {
    FileEntry,
    MediaGroupForm,
    MediaGroupFormParams,
    MediaGroupTarget,
    PropertyDefinition,
    PropertyDefinitionGroup,
} from "../src";

/**
 * How the group will look, following the form as it's filled in: its cover drawn by the picture's own
 * sizes, and its name and type as they're typed.
 */
const GroupPreview = ({ values }: MediaGroupFormParams) => (
    <div className={styles.preview}>
        <ResponsivePicture entry={values.cover as FileEntry | undefined} sizes="72px" className={styles.previewCover} />
        <div>
            <Text className={styles.previewName}>
                <bdi>{String(values.name ?? "").trim() || "Untitled"}</bdi>
            </Text>
            <Text className={styles.previewType}>{String(values.type ?? "")}</Text>
        </div>
    </div>
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
