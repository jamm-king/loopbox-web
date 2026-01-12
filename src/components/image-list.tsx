"use client";

import { useState } from "react";
import { Image, ImageVersion } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatusBadgeVariant } from "@/lib/status-badge";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { imageApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

interface ImageListProps {
    projectId: string;
    images: Image[];
}

export function ImageList({ projectId, images }: ImageListProps) {
    const router = useRouter();
    const [expandedImageIds, setExpandedImageIds] = useState<Set<string>>(new Set());
    const [imageDetails, setImageDetails] = useState<Record<string, { versions: ImageVersion[] }>>({});
    const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set());

    const handleDragStart = (event: React.DragEvent, versionId: string) => {
        event.stopPropagation();
        event.dataTransfer.setData("application/x-loopbox", JSON.stringify({ type: "image-version", id: versionId }));
        event.dataTransfer.setData("text/plain", `image-version:${versionId}`);
        event.dataTransfer.effectAllowed = "copy";
    };

    const handleDelete = async (imageId: string) => {
        if (!window.confirm("Are you sure you want to delete this image?")) {
            return;
        }

        try {
            await imageApi.delete(projectId, imageId);
            router.refresh();
            window.dispatchEvent(new Event("refresh-sidebar"));
        } catch (error) {
            console.error("Failed to delete image:", error);
            toast("Failed to delete image", "error");
        }
    };

    const toggleVersions = async (imageId: string) => {
        setExpandedImageIds((prev) => {
            const next = new Set(prev);
            if (next.has(imageId)) {
                next.delete(imageId);
            } else {
                next.add(imageId);
            }
            return next;
        });
        if (!imageDetails[imageId]) {
            setLoadingVersions((prev) => new Set(prev).add(imageId));
            try {
                const response = await imageApi.get(projectId, imageId);
                setImageDetails((prev) => ({
                    ...prev,
                    [imageId]: { versions: response.versions },
                }));
            } catch (error) {
                console.error("Failed to fetch image versions:", error);
                toast("Failed to load image versions", "error");
            } finally {
                setLoadingVersions((prev) => {
                    const next = new Set(prev);
                    next.delete(imageId);
                    return next;
                });
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Images</h2>
                <Link href={`/project/${projectId}/image/new`}>
                    <Button>Create Image</Button>
                </Link>
            </div>
            {images.length === 0 ? (
                <Card>
                    <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
                        No images created yet.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {images.map((image) => (
                        <Card key={image.id} className="transition-all hover:border-primary/50 hover:shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => toggleVersions(image.id)}
                                        title="Toggle versions"
                                    >
                                        {expandedImageIds.has(image.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </Button>
                                    <CardTitle className="text-lg font-medium">
                                        Image {image.id.slice(0, 8)}
                                    </CardTitle>
                                    <Badge variant={getStatusBadgeVariant(image.status)}>
                                        {image.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={`/project/${projectId}/image/${image.id}`}>
                                        <Button variant="outline" size="sm">
                                            View Details
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => image.status !== "GENERATING" && image.status !== "DELETING" && handleDelete(image.id)}
                                        disabled={image.status === "GENERATING" || image.status === "DELETING"}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {expandedImageIds.has(image.id) ? (
                                        loadingVersions.has(image.id) ? (
                                            <div className="text-sm text-muted-foreground">Loading versions...</div>
                                        ) : imageDetails[image.id]?.versions?.length ? (
                                            <div className="space-y-2">
                                                {imageDetails[image.id].versions.map((version) => (
                                                    <div
                                                        key={version.id}
                                                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
                                                        draggable
                                                        onDragStart={(event) => handleDragStart(event, version.id)}
                                                    >
                                                        <div className="text-muted-foreground">
                                                            Version {version.id.slice(0, 8)}
                                                        </div>
                                                        <div className="text-muted-foreground">
                                                            {version.id.slice(0, 6)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">No versions yet.</div>
                                        )
                                    ) : (
                                        <div className="text-sm text-muted-foreground">
                                            Expand to see versions
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
