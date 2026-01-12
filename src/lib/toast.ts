export type ToastVariant = "success" | "error" | "info";

export interface ToastPayload {
    message: string;
    variant?: ToastVariant;
}

export const toast = (message: string, variant: ToastVariant = "info") => {
    if (typeof window === "undefined") {
        return;
    }

    const event = new CustomEvent<ToastPayload>("app-toast", {
        detail: { message, variant },
    });
    window.dispatchEvent(event);
};
