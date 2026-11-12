# Changelog

filecove follows [semantic versioning](https://semver.org). Below 1.0, a minor version (0.2.0) may change the API; a patch (0.1.1) never does.

## 0.1.0 (2026-11-12)

The first release.

- `FileManager`: a file manager over any backend, through an adapter whose optional members switch features on: sections, list and grid views, sorting and zoom, the folder search and search everywhere, drag and drop, copy and move in the background (between backends too), uploads of files and folders, downloads, a preview with previewers of your own, a properties panel with editable fields, a trash, undo and redo, permissions, keyboard navigation, screen reader support and right to left.
- `MediaManager`: libraries of pictures, videos, audio and documents, with groups, picking with forms of your own, uploads, processing and the backend's errors per pick.
- `MediaPicker`, `MediaPicture`, `MediaTile`, `MediaRow`, `MediaFields` and `PropertyDefinition`s for fields and properties of your own.
- Theming with `--fm-*` custom properties, two stylesheets (`styles.css`, `styles.layer.css`), stable class names (`fmClasses`), `slots`, `slotProps` and `headerActions`.
- Material icons in five styles (`filecove/icons/<style>`), and `IconProvider`.
- English text (`enUS`), replaceable through `localeText`.
- Documentation in `docs/`, shipped in the package.

Known limits: type declarations need TypeScript's `moduleResolution: "bundler"`; browsers from Chrome 123, Safari 17.5 and Firefox 120.
