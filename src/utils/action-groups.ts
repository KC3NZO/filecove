import type { KeyboardEvent } from "react";

import { matchesShortcut, pressedKeys } from "./shortcut";

import type { ActionContext, ActionGroup, ToolbarGroup } from "../types";

/** The actions that apply to a context, still grouped, with groups left empty dropped. */
export const visibleActionGroups = (groups: ActionGroup[], context: ActionContext): ActionGroup[] =>
    groups
        .map((group) => ({
            ...group,
            actions: group.actions.filter(
                (action) =>
                    (!action.target || action.target === context.target) &&
                    (!action.single || context.entries.length <= 1) &&
                    (action.visible?.(context) ?? true),
            ),
        }))
        .filter((group) => group.actions.length > 0);

/**
 * The actions that apply to a context as a header shows them, the preview's or the properties
 * panel's, each bound to the context; none without one.
 */
export const toolbarGroups = (groups: ActionGroup[], context: ActionContext | null): ToolbarGroup[] =>
    context
        ? visibleActionGroups(groups, context).map((group) => ({
              id: group.id,
              actions: group.actions.map((action) => ({
                  id: action.id,
                  label: action.label,
                  icon: action.icon,
                  shortcut: action.shortcut,
                  disabled: !!action.disabled?.(context),
                  destructive: !!action.destructive,
                  run: () => action.onSelect(context),
              })),
          }))
        : [];

/**
 * Runs the header action whose `shortcut` a key press matches, trying the key the layout types
 * first, and says whether one matched. One that's disabled still takes the key, as in the content.
 */
export const runToolbarShortcut = (event: KeyboardEvent, groups: readonly ToolbarGroup[]) => {
    const actions = groups.flatMap((group) => group.actions);

    return pressedKeys(event).some((key) => {
        const action = actions.find((candidate) => candidate.shortcut && matchesShortcut(event, candidate.shortcut, key));

        if (action && !action.disabled) {
            action.run();
        }

        return !!action;
    });
};
