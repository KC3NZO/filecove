import type { ActionContext, ActionGroup } from "../types";

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
