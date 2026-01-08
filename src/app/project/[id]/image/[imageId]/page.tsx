import { imageApi } from "@/lib/api";
import type { Image, ImageVersion } from "@/lib/api-types";
import { GenerateImageVersionForm } from "@/components/generate-image-version-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeVariant } from "@/lib/status-badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ImageDetailPageProps {
    params: Promise<{
        id: string;
        imageId: string;
    }>;
}

export default async function ImageDetailPage({ params }: ImageDetailPageProps) {
    const { id: projectId, imageId } = await params;

    let image: Image | null = null;
    let versions: ImageVersion[] = [];
    let errorMessage: string | null = null;

    try {
        const response = await imageApi.get(projectId, imageId);
        image = response.image;
        versions = response.versions;
    } catch (e) {
        console.error("Failed to fetch image details", e);
        errorMessage = "Failed to load this image. Check the backend connection or ID.";
    }

    if (!image) {
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
            </div>

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
                    <GenerateImageVersionForm
                        projectId={projectId}
                        imageId={imageId}
                        isImageGenerating={image.status === "GENERATING"}
                    />
                </div>
            </div>
        </main>
    );
}
