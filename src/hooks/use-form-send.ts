import { useEffect, useRef, useState } from "react";

import { NO_ERRORS, refusalOf } from "../utils/field-errors";

import type { FieldErrors } from "../types";

/**
 * Sending an upload's or a process form, which stays open until it's answered, to say why when it's
 * refused: whether it's being sent, the refusal's message for over the form and its errors for under the
 * fields, until it's sent again. Leaving stops it, as going away does.
 */
export const useFormSend = (fallback: string) => {
    const [sending, setSending] = useState(false);
    const [failure, setFailure] = useState<string>();
    const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const send = (work: (signal: AbortSignal) => unknown, done: () => void) => {
        if (sending) {
            return;
        }

        const controller = new AbortController();

        controllerRef.current = controller;
        setSending(true);
        setFailure(undefined);
        setErrors(NO_ERRORS);
        Promise.resolve()
            .then(() => work(controller.signal))
            .then(
                () => {
                    if (!controller.signal.aborted) {
                        setSending(false);
                        done();
                    }
                },
                (error: unknown) => {
                    if (!controller.signal.aborted) {
                        const refusal = refusalOf(error, fallback);

                        setSending(false);
                        setFailure(refusal.message);
                        setErrors(refusal.errors);
                    }
                },
            );
    };

    return { sending, failure, errors, send, abort: () => controllerRef.current?.abort() };
};
