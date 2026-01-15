"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { musicApi } from "@/lib/api";
import type { Music, MusicVersion } from "@/lib/api-types";
import { GenerateVersionForm } from "@/components/generate-version-form";
import { MusicAliasEditor } from "@/components/music-alias-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTH_EVENT_NAME, AUTH_STORAGE_KEY, loadAuthState } from "@/lib/auth";

export default function MusicDetailPage() {
    const params = useParams<{ id: string; musicId: string }>();
    const projectId = params?.id;
    const musicId = params?.musicId;

    const [music, setMusic] = useState<Music | null>(null);
    const [versions, setVersions] = useState<MusicVersion[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);

    const refreshMusicDetails = async (silent = false) => {
        if (!projectId || !musicId) return;
        if (!silent) {
            setIsLoading(true);
        }
        try {
            const response = await musicApi.get(projectId, musicId);
            setMusic(response.music);
            setVersions(response.versions);
        } catch (error) {
            console.error("Failed to fetch music details", error);
            setErrorMessage("Failed to load this music. Check the backend connection or ID.");
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
                setMusic(null);
                setVersions([]);
                setIsLoading(false);
                return;
            }
            setIsAuthed(true);
            refreshMusicDetails();
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
    }, [projectId, musicId]);

    useEffect(() => {
        if (!isAuthed || !music || music.status !== "GENERATING") return;
        const intervalId = window.setInterval(() => {
            refreshMusicDetails(true);
        }, 5000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [isAuthed, music?.status, projectId, musicId]);

    if (!projectId || !musicId) {
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
                        You need to log in to view this music.{" "}
                        <Link className="text-primary hover:underline" href="/auth/login">
                            Go to login
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!music && !isLoading) {
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
                {music && <MusicAliasEditor projectId={projectId} music={music} />}
            </div>

            {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading music...</div>
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
                        {music && (
                            <GenerateVersionForm
                                projectId={projectId}
                                musicId={musicId}
                                isMusicGenerating={music.status === "GENERATING"}
                                onStartGenerating={() => {
                                    setMusic((prev) => (prev ? { ...prev, status: "GENERATING" } : prev));
                                }}
                                onGenerated={(status) => {
                                    setMusic((prev) => (prev ? { ...prev, status } : prev));
                                    refreshMusicDetails(true);
                                }}
                                onGenerationFailed={() => {
                                    setMusic((prev) => (prev ? { ...prev, status: "IDLE" } : prev));
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
