"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface RefreshOnEventProps {
    eventName: string;
}

export function RefreshOnEvent({ eventName }: RefreshOnEventProps) {
    const router = useRouter();

    useEffect(() => {
        const handler = () => router.refresh();
        window.addEventListener(eventName, handler);
        return () => window.removeEventListener(eventName, handler);
    }, [eventName, router]);

    return null;
}
