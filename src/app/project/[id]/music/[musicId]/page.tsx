import { musicApi } from "@/lib/api";
import type { Music, MusicVersion } from "@/lib/api-types";
import { GenerateVersionForm } from "@/components/generate-version-form";
import { MusicAliasEditor } from "@/components/music-alias-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface MusicDetailPageProps {
    params: Promise<{
        id: string;
        musicId: string;
    }>;
}

export default async function MusicDetailPage({ params }: MusicDetailPageProps) {
    const { id: projectId, musicId } = await params;

    let music: Music | null = null;
    let versions: MusicVersion[] = [];
    let errorMessage: string | null = null;

    try {
        const response = await musicApi.get(projectId, musicId);
        music = response.music;
        versions = response.versions;
    } catch (e) {
        console.error("Failed to fetch music details", e);
        errorMessage = "Failed to load this music. Check the backend connection or ID.";
    }

    if (!music) {
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
                        {errorMessage ?? "Music not found."}
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
                <MusicAliasEditor projectId={projectId} music={music} />
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
                                        {(() => {
                                            const uniqueTags = new Set<string>();
                                            if (version.config.mood) uniqueTags.add(version.config.mood);
                                            if (version.config.melody) uniqueTags.add(version.config.melody);
                                            if (version.config.harmony) uniqueTags.add(version.config.harmony);
                                            if (version.config.bass) uniqueTags.add(version.config.bass);
                                            if (version.config.beat) uniqueTags.add(version.config.beat);

                                            return (
                                                <div className="flex flex-wrap gap-2">
                                                    {Array.from(uniqueTags).map((tag) => (
                                                        <Badge key={tag} variant="outline">{tag}</Badge>
                                                    ))}
                                                    {version.config.bpm && <Badge variant="outline">{version.config.bpm} BPM</Badge>}
                                                </div>
                                            );
                                        })()}
                                    </CardHeader>
                                    <CardContent>
                                        {version.fileId ? (
                                            <audio controls className="w-full">
                                                <source src={musicApi.getAudioUrl(musicId, version.id)} type="audio/mpeg" />
                                                Your browser does not support the audio element.
                                            </audio>
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
                    <GenerateVersionForm
                        projectId={projectId}
                        musicId={musicId}
                        isMusicGenerating={music.status === 'GENERATING'}
                    />
                </div>
            </div>
        </main>
    );
}
