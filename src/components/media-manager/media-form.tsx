import { isValidElement, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import Text from "../ui/text";

import styles from "./media-form.module.css";

interface MediaFormBodyProps<P> {
    form: { render(params: P): ReactNode };
    params: P;
}

interface ChoiceMessagesProps {
    /** The pick's own messages, about it as a whole, which `choiceErrorKey` finds. */
    messages: readonly string[];
}

interface FormFailureProps {
    /** Why the backend refused what the form holds. */
    message: string;
}

let warnedOfInnerComponent = false;

/**
 * A form of the app's, drawn as a component of its own, so hooks in its `render` always belong to the
 * same one, wherever it's shown and whatever's shown around it. A component made afresh inside `render`
 * would start over at each change, losing the focus and what its hooks hold, so that's warned of, once:
 * the same name as last time on another function can only be that.
 */
export const MediaFormBody = <P,>({ form, params }: MediaFormBodyProps<P>) => {
    const lastTypeRef = useRef<{ name: string } | undefined>(undefined);
    const drawn = form.render(params);
    const type = isValidElement(drawn) && typeof drawn.type === "function" ? drawn.type : undefined;

    useEffect(() => {
        const last = lastTypeRef.current;

        lastTypeRef.current = type;

        if (type && last && type !== last && type.name === last.name && !warnedOfInnerComponent) {
            warnedOfInnerComponent = true;
            console.warn(
                `MediaManager: a form's \`render\` returned a new \`${type.name}\` component. Define it outside \`render\`, or it starts over at each change, losing the focus and what its hooks hold.`,
            );
        }
    });

    return drawn;
};

/** A pick's own errors, above its form. */
export const ChoiceMessages = ({ messages }: ChoiceMessagesProps) =>
    messages.length > 0 && (
        <div className={styles.ownMessages}>
            {messages.map((message, place) => (
                <bdi key={place}>{message}</bdi>
            ))}
        </div>
    );

/** Why an upload's or a process form was refused, over it, brought into view as the form may be scrolled. */
export const FormFailure = ({ message }: FormFailureProps) => {
    const ref = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        ref.current?.scrollIntoView({ block: "nearest" });
    }, [message]);

    return (
        <Text ref={ref} role="alert" variant="body2" color="error">
            <bdi>{message}</bdi>
        </Text>
    );
};
