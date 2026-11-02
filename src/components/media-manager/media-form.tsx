import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

interface MediaFormBodyProps<P> {
    form: { render(params: P): ReactNode };
    params: P;
}

interface ChoiceMessagesProps {
    /** The pick's own messages, about it as a whole, which `choiceErrorKey` finds. */
    messages: readonly string[];
}

// Each message on a line of its own, marked by a rule at their start side, which forced colors keep.
const ownMessagesSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
    mb: 2,
    paddingInlineStart: 1.25,
    borderInlineStart: "3px solid",
    color: "error.main",
    fontSize: "0.8125rem",
    overflowWrap: "anywhere",
};

/**
 * A form of the app's, drawn as a component of its own, so hooks in its `render` always belong to the
 * same one, wherever it's shown and whatever's shown around it.
 */
export const MediaFormBody = <P,>({ form, params }: MediaFormBodyProps<P>) => form.render(params);

/** A pick's own errors, above its form. */
export const ChoiceMessages = ({ messages }: ChoiceMessagesProps) =>
    messages.length > 0 && (
        <Box sx={ownMessagesSx}>
            {messages.map((message, place) => (
                <bdi key={place}>{message}</bdi>
            ))}
        </Box>
    );
