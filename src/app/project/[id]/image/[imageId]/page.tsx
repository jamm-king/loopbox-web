"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { imageApi } from "@/lib/api";
import type { Image, ImageVersion } from "@/lib/api-types";
import { GenerateImageVersionForm } from "@/components/generate-image-version-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeVariant } from "@/lib/status-badge";
import { AUTH_EVENT_NAME, AUTH_STORAGE_KEY, loadAuthState } from "@/lib/auth";
import { toast } from "@/lib/toast";

export default function ImageDetailPage() {
    const params = useParams<{ id: string; imageId: string }>();
    const projectId = params?.id;
    const imageId = params?.imageId;

    const [image, setImage] = useState<Image | null>(null);
    const [versions, setVersions] = useState<ImageVersion[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const previousStatusRef = useRef<string | null>(null);

    const refreshImageDetails = async (silent = false) => {
        if (!projectId || !imageId) return;
        if (!silent) {
            setIsLoading(true);
        }
        try {
            const response = await imageApi.get(projectId, imageId);
            setImage(response.image);
            setVersions(response.versions);
        } catch (error) {
            console.error("Failed to fetch image details", error);
            setErrorMessage("Failed to load this image. Check the backend connection or ID.");
        } finally {
            if (!silent) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        const handleAuthChange = () => {
            const auth = loadAuthState();
            if (!auth) {
                setIsAuthed(false);
                setImage(null);
                setVersions([]);
                setIsLoading(false);
                return;
            }
            setIsAuthed(true);
            refreshImageDetails();
        };
        const handleStorage = (event: StorageEvent) => {
            if (!event.key || event.key === AUTH_STORAGE_KEY) {
                handleAuthChange();
            }
        };

        handleAuthChange();
        window.addEventListener(AUTH_EVENT_NAME, handleAuthChange);
        window.addEventListener("storage", handleStorage);

        return () => {
            window.removeEventListener(AUTH_EVENT_NAME, handleAuthChange);
            window.removeEventListener("storage", handleStorage);
        };
    }, [projectId, imageId]);

    useEffect(() => {
        if (!isAuthed || !image || image.status !== "GENERATING") return;
        const intervalId = window.setInterval(() => {
            refreshImageDetails(true);
        }, 5000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [isAuthed, image?.status, projectId, imageId]);

    useEffect(() => {
        if (!image) {
            return;
        }
        const previousStatus = previousStatusRef.current;
        if (previousStatus === "GENERATING" && image.status === "IDLE") {
            toast("Image version completed", "success");
        }
        previousStatusRef.current = image.status;
    }, [image?.status]);

    if (!projectId || !imageId) {
        return null;
    }

    if (!isAuthed && !isLoading) {
        return (
            <main className="flex min-h-screen flex-col p-8 md:p-24">
                <div className="mb-8 space-y-4">
                    <Link href={`/project/${projectId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Project
                    </Link>
                    <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        You need to log in to view this image.{" "}
                        <Link className="text-primary hover:underline" href="/auth/login">
                            Go to login
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!image && !isLoading) {
        return (
            <main className="flex min-h-screen flex-col p-8 md:p-24">
                <div className="mb-8 space-y-4">
                    <Link href={`/project/${projectId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Project
                    </Link>
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                        {errorMessage ?? "Image not found."}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col p-8 md:p-24">
            <div className="mb-8 space-y-4">
                <Link href={`/project/${projectId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Project
                </Link>
                {image && (
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h1 className="text-4xl font-bold tracking-tight">Image Details</h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span>ID: {image.id}</span>
                                <Badge variant={getStatusBadgeVariant(image.status)}>
                                    {image.status}
                                </Badge>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading image...</div>
            ) : (
                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-2xl font-semibold tracking-tight">Versions</h2>
                        {versions.length === 0 ? (
                            <Card>
                                <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
                                    No versions generated yet.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {versions.map((version) => (
                                    <Card key={version.id}>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Version {version.id}</CardTitle>
                                            <div className="flex flex-wrap gap-2">
                                                {version.config.description && (
                                                    <Badge variant="outline">{version.config.description}</Badge>
                                                )}
                                                {version.config.width && <Badge variant="outline">{version.config.width}px</Badge>}
                                                {version.config.height && <Badge variant="outline">{version.config.height}px</Badge>}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {version.url ? (
                                                <div className="overflow-hidden rounded-md border">
                                                    <img
                                                        src={version.url}
                                                        alt={`Version ${version.id}`}
                                                        className="h-auto w-full object-cover"
                                                    />
                                                </div>
                                            ) : null}
                                            {version.fileId ? (
                                                <div className="text-sm text-muted-foreground">
                                                    File ID: {version.fileId}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">Processing...</div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="sticky top-8 self-start">
                        {image && (
                            <GenerateImageVersionForm
                                projectId={projectId}
                                imageId={imageId}
                                isImageGenerating={image.status === "GENERATING"}
                                onStartGenerating={() => {
                                    setImage((prev) => (prev ? { ...prev, status: "GENERATING" } : prev));
                                }}
                                onGenerated={(status) => {
                                    setImage((prev) => (prev ? { ...prev, status } : prev));
                                    refreshImageDetails(true);
                                }}
                                onGenerationFailed={() => {
                                    setImage((prev) => (prev ? { ...prev, status: "IDLE" } : prev));
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
