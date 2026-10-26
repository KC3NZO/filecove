import type { Section } from "../types";

/**
 * Whether entries listed in `source` may be moved or copied into `target`, by `target`'s
 * `importFrom`. Within a section they always may. The adapters aren't compared here.
 */
export const importsFrom = (target: Section, source: Section) => {
    const rule = target.importFrom ?? true;

    if (target.id === source.id || rule === true) {
        return true;
    }

    if (rule === false) {
        return false;
    }

    return rule.allow ? rule.allow.includes(source.id) : !rule.deny?.includes(source.id);
};

/**
 * Whether nothing in a section changes through the file manager's own operations: it's `readOnly`,
 * or it's the trash, whose root's entries are only restored or deleted for good.
 */
export const sectionLocked = (section: Section) => !!section.readOnly || !!section.trash;
