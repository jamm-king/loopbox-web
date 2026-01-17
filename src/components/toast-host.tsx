"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ToastPayload, ToastVariant } from "@/lib/toast";

interface ToastItem extends ToastPayload {
    id: string;
}

const variantClasses: Record<ToastVariant, string> = {
    success: "border-green-600 bg-green-100 text-green-800",
    error: "border-destructive bg-destructive text-destructive-foreground",
    info: "border-border bg-card text-foreground",
};

export function ToastHost() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const handler = (event: Event) => {
            const customEvent = event as CustomEvent<ToastPayload>;
            const detail = customEvent.detail;
            if (!detail?.message) {
                return;
            }

            const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const toast: ToastItem = {
                id,
                message: detail.message,
                variant: detail.variant ?? "info",
            };

            setToasts((prev) => [...prev, toast]);
            const timeoutId = window.setTimeout(() => {
                setToasts((prev) => prev.filter((item) => item.id !== id));
            }, 5000);

            return () => window.clearTimeout(timeoutId);
        };

        window.addEventListener("app-toast", handler);
        return () => window.removeEventListener("app-toast", handler);
    }, []);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        "rounded-md border px-4 py-3 text-sm shadow-md",
                        variantClasses[toast.variant ?? "info"]
                    )}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
}
