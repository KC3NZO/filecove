import { useCallback, useRef, useState } from "react";

import { MediaManager } from "../src";
import { createMediaActions } from "./media-actions";
import { renderAudio, renderGroup, renderGroupHeader, renderStock } from "./media-assets";
import { pickForm, stockPickForm } from "./media-fields";
import { groupForm } from "./media-groups";
import { audioPreviewer, hlsPreviewer } from "./media-previewers";
import { audioProcessForm, imageProcessForm, videoProcessForm } from "./media-processing";
import { assetProperties, videoEntryProperties } from "./media-properties";
import { noOverlapping } from "./media-relation";
import { audioUploadForm, imageUploadForm, videoUploadForm } from "./media-uploads";
import { siteMediaAdapter, stockMediaAdapter } from "./mocks/mock-media";
import { savePicks } from "./mocks/mock-save";
import { locationInHash, useMediaLocation } from "./hooks/use-media-location";
import { useStoredState } from "./hooks/use-stored-state";
import {
    browse,
    limits,
    live,
    locale,
    maxChoices,
    multiple,
    noOverlap,
    oneVideo,
    relistAfter,
    selectGroups,
    single,
    slots,
    uncontrolled,
} from "./options";
import { mediaManagerSlots } from "./slots";
import { Button, Snackbar, Text } from "./ui";
import styles from "./media-app.module.css";

import type {
    FieldErrors,
    FileEntry,
    MediaChoice,
    MediaLayouts,
    MediaLocation,
    MediaManagerApi,
    MediaSearch,
    MediaSection,
    MediaSectionGroup,
    MediaViewed,
    PropertyErrorKeyParams,
} from "../src";

// The media manager's page (`?media`), full-viewport with a footer saying what was last chosen, as
// an editor inserting it would, each pick with what the playground's fields hold for it. Choose
// saves the picks to the playground's backend first, which may answer with errors, as Laravel's
// validation does, handed back to the media manager as they came; the list's own (`media`), which
// is about no pick, the footer shows, as an app would beside it.

// What this site's groups hold, by what they are: an album or a season holds only assets, and anything
// else, a collection or a series, or one not said yet, may hold more groups.
const holdsGroups = (parent: FileEntry | null) => parent?.meta?.type !== "Album" && parent?.meta?.type !== "Season";

/**
 * Whether a stock photo may be used, as the app's own rule: not one whose licence has run out, those
 * numbered 06, 12 and 18, which its backend refuses as well when the picks are saved.
 */
const stockSelectable = (entry: FileEntry) => !/-(?:06|12|18)\./.test(entry.name) || "Licence expired";

/** The rule of a carousel taking one video at most, for this use of the media manager (`?oneVideo`). */
const oneVideoAtMost = (_asset: FileEntry, section: MediaSection, choices: readonly MediaChoice[]) =>
    section.kind !== "video" ||
    !choices.some((choice) => choice.section.kind === "video") ||
    "Only one video can be used";

/**
 * The playground's libraries, on two backends: this site's, a root a kind, whose videos are
 * delivered by HLS and so previewed by its own player, and show their renditions, poster and tracks
 * by definitions of their own, and a stock library's, read-only. This site's take uploads of their
 * own kind, asking first what its backend should make of them, but documents, which it takes as
 * they are; and what's uploaded can be processed again from its view.
 */
const libraries: MediaSectionGroup[] = [
    {
        id: "site",
        title: "This site",
        sections: [
            {
                id: "images",
                label: "Images",
                kind: "image",
                rootId: "/images",
                layouts: ["grid", "list"],
                createGroups: holdsGroups,
                acceptUploads: "image/*",
                uploadForm: imageUploadForm,
                processForm: imageProcessForm,
            },
            {
                id: "videos",
                label: "Videos",
                kind: "video",
                rootId: "/videos",
                layouts: ["grid", "list"],
                createGroups: holdsGroups,
                previewers: [hlsPreviewer],
                properties: videoEntryProperties,
                acceptUploads: "video/*",
                uploadForm: videoUploadForm,
                processForm: videoProcessForm,
            },
            {
                id: "audio",
                label: "Audio",
                kind: "audio",
                rootId: "/audio",
                layouts: ["list", "grid"],
                createGroups: holdsGroups,
                groupForm,
                renderAsset: renderAudio,
                acceptUploads: "audio/*",
                uploadForm: audioUploadForm,
                processForm: audioProcessForm,
            },
            {
                id: "documents",
                label: "Documents",
                kind: "document",
                rootId: "/documents",
                layouts: ["list"],
                acceptUploads: ".pdf,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.txt,.csv",
            },
        ],
    },
    {
        id: "shared",
        title: "Shared",
        sections: [
            {
                id: "stock",
                label: "Stock photos",
                kind: "image",
                icon: "star",
                rootId: "/",
                adapter: stockMediaAdapter,
                renderAsset: renderStock,
                readOnly: true,
                selectable: stockSelectable,
                pickForm: stockPickForm,
            },
            // A library whose root refuses to be listed, to see the error.
            { id: "archive", label: "Old archive", kind: "image", icon: "drive", rootId: "/old/archive" },
        ],
    },
];

const previewers = [audioPreviewer];

// The libraries shown, which the location in the hash is read against.
const shownSections = single ? [libraries[0].sections[0]] : libraries.flatMap((group) => group.sections);

const groupAt = (id: string): FileEntry => ({ id, name: id.slice(id.lastIndexOf("/") + 1), kind: "folder" });

// Where the footer's "Go to a group" leads, and what its "Show an asset" opens, known by their ids and
// names alone, as an app's own links to them would be.
const groupTarget: MediaLocation = single
    ? { sectionId: "images", trail: [groupAt("/images/Summer 2026"), groupAt("/images/Summer 2026/Harbour festival")] }
    : { sectionId: "audio", trail: [groupAt("/audio/The Harbour Hour"), groupAt("/audio/The Harbour Hour/Season 1")] };

const assetTarget: { entry: FileEntry; location: MediaLocation } = single
    ? {
          entry: { id: "/images/Summer 2026/summer-poster.png", name: "summer-poster.png", kind: "file" },
          location: { sectionId: "images", trail: [groupAt("/images/Summer 2026")] },
      }
    : {
          entry: { id: "/videos/intro.webm", name: "intro.webm", kind: "file" },
          location: { sectionId: "videos", trail: [] },
      };

/** Where a pick's own errors are, as the playground's backend names them: `media.0`, `media.0.id`. */
const choiceErrorKey = ({ index }: PropertyErrorKeyParams) => [`media.${index}`, `media.${index}.id`];

/** A pick as an app would store it: its library's id with the asset's, and what's filled in. */
const describeOne = ({ asset, section, values }: MediaChoice) => {
    const filled = Object.entries(values)
        .filter(([, value]) => value !== undefined && value !== "" && value !== false)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

    return `${section.id}:${asset.id}${filled.length > 0 ? ` (${filled.join(", ")})` : ""}`;
};

/**
 * Where saving the picks is at: refused, with how many errors came, and the list's own message, when
 * it has one, which is the app's to show.
 */
type Saving = { status: "idle" } | { status: "saving" } | { status: "refused"; count: number; list?: string };

/** The first message under a key of what the backend answered. */
const firstMessage = (errors: FieldErrors, key: string) => {
    const found = errors[key];

    return typeof found === "string" ? found : found?.[0];
};

const describe = (chosen: MediaChoice[] | null, picked: MediaChoice[], saving: Saving) => {
    if (live) {
        return picked.length > 0 ? `Selected: ${picked.map(describeOne).join("; ")}` : "Nothing selected";
    }

    if (saving.status === "saving") {
        return "Saving…";
    }

    if (saving.status === "refused") {
        const count = `${saving.count === 1 ? "1 error" : `${saving.count} errors`} to fix`;

        return `The backend refused it: ${saving.list ? `${saving.list} (${count})` : count}`;
    }

    if (!chosen) {
        return browse ? "Browsing, nothing to choose" : "Nothing chosen yet";
    }

    return `Chosen: ${chosen.map(describeOne).join("; ")}`;
};

const MediaApp = () => {
    const [chosen, setChosen] = useState<MediaChoice[] | null>(null);
    // What's selected, kept here as an app would, unless `?uncontrolled` leaves it to the media manager.
    const [picked, setPicked] = useState<MediaChoice[]>([]);
    const [errors, setErrors] = useState<FieldErrors>();
    const [saving, setSaving] = useState<Saving>({ status: "idle" });
    // What the header's actions last said, as an app would show it.
    const [notice, setNotice] = useState({ open: false, message: "" });
    const [actions] = useState(() => createMediaActions((message) => setNotice({ open: true, message })));
    // Which layout each library was last shown in, kept across reloads, as a consumer might.
    const [layout, setLayout] = useStoredState<MediaLayouts>("media-layout", {});
    // Where it is, in the URL's hash, and what's shown in a library's place and searched, kept here as
    // an app would, unless `?uncontrolled` leaves them to the media manager, starting where the hash says.
    const [location, setLocation] = useMediaLocation(shownSections);
    const [viewed, setViewed] = useState<MediaViewed | null>(null);
    const [search, setSearch] = useState<MediaSearch | null>(null);
    const [startedAt] = useState(() => locationInHash(shownSections) ?? undefined);
    const api = useRef<MediaManagerApi>(null);
    const say = (message: string) => setNotice({ open: true, message });

    // Saved first, as an app would save a product's carousel: what the backend refuses goes back to
    // the media manager, and what it takes is chosen.
    const choose = useCallback((choices: MediaChoice[]) => {
        setSaving({ status: "saving" });
        void savePicks(choices).then((answered) => {
            setErrors(answered ?? undefined);

            if (answered) {
                setSaving({
                    status: "refused",
                    count: Object.keys(answered).length,
                    list: firstMessage(answered, "media"),
                });
            } else {
                setSaving({ status: "idle" });
                setChosen(choices);
            }
        });
    }, []);
    const shared = {
        adapter: siteMediaAdapter,
        multiple,
        maxChoices,
        canSelect: oneVideo ? oneVideoAtMost : noOverlap ? noOverlapping : undefined,
        selectGroups,
        actions,
        slots: slots ? mediaManagerSlots : undefined,
        ...(uncontrolled
            ? { defaultLayout: layout, defaultLocation: startedAt }
            : {
                  layout,
                  onLayoutChange: setLayout,
                  location,
                  onLocationChange: setLocation,
                  viewed,
                  onViewedChange: setViewed,
                  search,
                  onSearchChange: setSearch,
              }),
        relistAfter,
        limits,
        apiRef: api,
        locale,
        onChoose: browse || live ? undefined : choose,
        ...(browse ? {} : uncontrolled ? { onChange: setPicked } : { value: picked, onChange: setPicked }),
        pickForm,
        renderGroup,
        groupHeader: renderGroupHeader,
        properties: assetProperties,
        previewers,
        errors,
        choiceErrorKey,
    };

    return (
        <div className={styles.app}>
            {single ? (
                <MediaManager {...shared} section={libraries[0].sections[0]} className={styles.mediaManager} />
            ) : (
                <MediaManager {...shared} sections={libraries} className={styles.mediaManager} />
            )}
            <footer className={styles.footer}>
                <Text variant="body2" noWrap className={styles.footerText}>
                    {describe(chosen, picked, saving)}
                </Text>
                {/* The app's own toolbar, driving the media manager through `apiRef`. */}
                <div className={styles.footerButtons}>
                    <Button
                        size="small"
                        color="inherit"
                        onClick={() => api.current?.navigate(groupTarget) || say("That library isn't shown")}
                    >
                        Go to {groupTarget.trail.at(-1)?.name}
                    </Button>
                    <Button
                        size="small"
                        color="inherit"
                        onClick={() =>
                            api.current?.view(assetTarget.entry, assetTarget.location) || say("Couldn't show it")
                        }
                    >
                        Show {assetTarget.entry.name}
                    </Button>
                    <Button
                        size="small"
                        color="inherit"
                        onClick={() => api.current?.search("harbour") || say("Nothing to search here")}
                    >
                        Search “harbour”
                    </Button>
                    <Button
                        size="small"
                        color="inherit"
                        onClick={() => api.current?.upload() || say("Nothing can be uploaded here")}
                    >
                        Upload…
                    </Button>
                    <Button size="small" color="inherit" onClick={() => api.current?.select([])}>
                        Clear selection
                    </Button>
                    <Button
                        size="small"
                        color="inherit"
                        onClick={() => api.current?.choose() || say("Nothing to choose, or something holds it back")}
                    >
                        Choose
                    </Button>
                    <Button size="small" color="inherit" onClick={() => api.current?.refresh()}>
                        Reload all
                    </Button>
                    <Button size="small" color="inherit" onClick={() => api.current?.focus()}>
                        Focus
                    </Button>
                </div>
            </footer>
            <Snackbar
                open={notice.open}
                message={notice.message}
                autoHideDuration={4000}
                onClose={() => setNotice((previous) => ({ ...previous, open: false }))}
            />
        </div>
    );
};

export default MediaApp;
