import type { ReactNode } from "react";

import type { FileAdapter, FileEntry } from "./adapter";

/** What a property's value is: text, a number, yes or no, or a date. */
export type PropertyType = "string" | "number" | "boolean" | "date";

/** A choice of a property chosen from a list, with its label in the app's language. */
export interface PropertyOption<T> {
    value: T;
    label: string;
}

/**
 * What every definition has, whatever its type. `V` is its value as it's shown and edited, after
 * `valueGetter`. Its functions are methods, so a definition of a `V` of its own still fits in a list
 * of plain `PropertyDefinition`s.
 */
interface PropertyBase<V> {
    /**
     * Where its value is: the key it's read by from the entry's `values` (what the adapter's
     * `properties` hands over, or what a pick's fields hold), and saved under. Unique among the
     * definitions shown together.
     */
    field: string;
    /** In the app's language, as section labels are. Empty, its row is its own `render`'s alone. */
    label: string;
    /**
     * Whether it can be changed: saved through the adapter's `updateProperties` in the properties,
     * kept with the pick in a pick's fields. Properties are shown only unless they say so; a pick's
     * fields are there to be filled in unless they say otherwise.
     */
    editable?: boolean;
    /** Marked as to be filled in. */
    required?: boolean;
    /** Gives it a button copying its text (`formattedValue`), e.g. for an address or a checksum. */
    copyable?: boolean;
    /**
     * Its value from the raw one under `field`, or from anything of the entry's: cast, reached into,
     * or put together, such as a picture's size from `entry.media`; undefined where there's none.
     * Without it, the raw value.
     */
    valueGetter?(value: unknown, entry: FileEntry): V | undefined;
    /**
     * Its text, in place of what its kind or type writes, e.g. "4K" for a height of 2160. Only
     * asked while it has a value.
     */
    valueFormatter?(value: V, entry: FileEntry): string;
    /**
     * Draws it, in place of its text: the app's own way of showing it, which may be a control
     * changing it in place through `save`, as a poster's frames to pick from are. Return the app's
     * own component as an element, `(params) => <JobList {...params} />`, so it can hold state and
     * hooks: poll the app's API, or listen to its socket, to stay live.
     */
    render?(params: PropertyRenderParams<V>): ReactNode;
    /** Its editor, in place of its kind's or its type's, handed the value being edited. */
    renderEdit?(params: PropertyEditParams<V>): ReactNode;
}

interface StringProperty<V> extends PropertyBase<V> {
    type: "string";
    /** "url": shown as a link, opening in a new tab, and edited in a field for a URL. */
    kind?: "url";
    /** What it's chosen from, as a select. */
    options?: PropertyOption<string>[];
    /**
     * A list of values: chosen from `options`, or without them typed in, each added with Enter or a
     * comma, as tags are.
     */
    multiple?: boolean;
    /** Edited over several lines, e.g. a caption. */
    multiline?: boolean;
    maxLength?: number;
    /** Shown in its field while it's empty; for a list, in the field a value is typed in. */
    placeholder?: string;
    /** The language of what's typed, as a BCP 47 tag, and its direction; "auto" when omitted. */
    lang?: string;
    dir?: "ltr" | "rtl" | "auto";
}

interface NumberProperty<V> extends PropertyBase<V> {
    type: "number";
    /**
     * "size": bytes, written "4.2 MB". "duration": seconds, written as a clock does, "3:34". Neither
     * has an editor of its own: give `renderEdit` to edit one.
     */
    kind?: "size" | "duration";
    options?: PropertyOption<number>[];
    multiple?: boolean;
    min?: number;
    max?: number;
    step?: number;
}

interface DateProperty<V> extends PropertyBase<V> {
    type: "date";
    /** "datetime": with its time, shown and edited. A day without its time otherwise. */
    kind?: "datetime";
    /** Days or times to choose from, each as an ISO string, as the value is saved. */
    options?: PropertyOption<string>[];
    multiple?: boolean;
}

/** Yes or No, edited with a checkbox. It has no kinds, options or lists. */
interface BooleanProperty<V> extends PropertyBase<V> {
    type: "boolean";
}

/**
 * No type: entirely the app's own, such as renditions with how far each is along, or a poster's
 * frames to pick from. Nothing but `render` can draw it, so that's required; it's changed by
 * `render` saving it in place, or by `renderEdit`.
 */
interface CustomProperty<V> extends PropertyBase<V> {
    type?: never;
    render(params: PropertyRenderParams<V>): ReactNode;
}

/**
 * How one property is shown and edited, as a data grid's column is: its type decides how its value
 * is written and edited, its kind refines that, `options` make it a choice and `multiple` a list,
 * and the functions change what's shown, a little (`valueFormatter`) or all of it (`render`,
 * `renderEdit`). Written in the app's code, for the values the adapter hands over (`values`).
 */
export type PropertyDefinition<V = unknown> =
    | StringProperty<V>
    | NumberProperty<V>
    | DateProperty<V>
    | BooleanProperty<V>
    | CustomProperty<V>;

/** Properties shown together, under a title when they have one, set apart by a rule. */
export interface PropertyDefinitionGroup {
    id: string;
    title?: string;
    properties: PropertyDefinition[];
}

/** What a property's `render` and `renderEdit` are handed. */
export interface PropertyParams<V = unknown> {
    definition: PropertyDefinition<V>;
    /** Undefined while it has none, which only an editable property is shown with. */
    value: V | undefined;
    /** Its text: `valueFormatter`'s, else its kind's, else its type's. What Copy copies. */
    formattedValue: string;
    /** The entry, or the media manager's asset, it's a property of. */
    entry: FileEntry;
    /** The adapter serving it, for a renderer asking it for more, e.g. through a method of its own. */
    adapter: FileAdapter;
    /** The id of its label, for a control of the app's to be named by (`aria-labelledby`). */
    labelId: string;
}

export interface PropertyRenderParams<V = unknown> extends PropertyParams<V> {
    /**
     * Saves a new value, for a control changing it in place: through the adapter's
     * `updateProperties` in the properties, while the property is `editable`, the adapter can save
     * and the entry can change there, or into the pick's values at once in a pick's fields.
     * Missing otherwise. Resolves with whether it was saved; a failure shows under it.
     */
    save?(value: V): Promise<boolean>;
    /** Whether a save of it is under way. */
    saving: boolean;
}

export interface PropertyEditParams<V = unknown> extends PropertyParams<V> {
    /** The id for its control, which its label is for. */
    id: string;
    /**
     * Sets the value being edited: in the properties, what their Save, Enter or the focus leaving
     * sends; in a pick's fields, the pick's value at once.
     */
    onChange(value: V | undefined): void;
    /** While it's saved, when it can't be changed. */
    disabled: boolean;
    /** Its save failed, which the control shows as an error. */
    error: boolean;
}
