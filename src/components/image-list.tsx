"use client";

import { Image } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatusBadgeVariant } from "@/lib/status-badge";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { imageApi } from "@/lib/api";
import { useRouter } from "next/navigation";

interface ImageListProps {
    projectId: string;
    images: Image[];
}

export function ImageList({ projectId, images }: ImageListProps) {
    const router = useRouter();

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
            alert("Failed to delete image");
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
                                    <div className="text-sm text-muted-foreground">
                                        Click details to see versions
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
