"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music, MusicVersion } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatusBadgeVariant } from "@/lib/status-badge";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { musicApi } from "@/lib/api";
import { getMusicDisplayName } from "@/lib/music-display";
import { clearDragPayload, setDragPayload } from "@/lib/drag-payload";
import { toast } from "@/lib/toast";
import { EVENTS } from "@/lib/events";

interface MusicListProps {
    projectId: string;
    musicList: Music[];
}

export function MusicList({ projectId, musicList }: MusicListProps) {
    const [editingMusicId, setEditingMusicId] = useState<string | null>(null);
    const [editingAlias, setEditingAlias] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [expandedMusicIds, setExpandedMusicIds] = useState<Set<string>>(new Set());
    const [musicDetails, setMusicDetails] = useState<Record<string, { versions: MusicVersion[] }>>({});
    const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set());
    const previousStatusRef = useRef<Record<string, string>>({});

    const refreshExpandedMusicDetails = useCallback(async () => {
        const expandedIds = Array.from(expandedMusicIds);
        if (expandedIds.length === 0) {
            return;
        }
        setLoadingVersions((prev) => {
            const next = new Set(prev);
            expandedIds.forEach((id) => next.add(id));
            return next;
        });
        await Promise.all(
            expandedIds.map(async (musicId) => {
                try {
                    const response = await musicApi.get(projectId, musicId);
                    setMusicDetails((prev) => ({
                        ...prev,
                        [musicId]: { versions: response.versions },
                    }));
                } catch (error) {
                    console.error("Failed to fetch music versions:", error);
                } finally {
                    setLoadingVersions((prev) => {
                        const next = new Set(prev);
                        next.delete(musicId);
                        return next;
                    });
                }
            })
        );
    }, [expandedMusicIds, projectId]);

    useEffect(() => {
        const handleRefresh = () => refreshExpandedMusicDetails();
        window.addEventListener(EVENTS.REFRESH_PROJECT_MUSIC, handleRefresh);
        window.addEventListener(EVENTS.MUSIC_LIST_UPDATED, handleRefresh);
        return () => {
            window.removeEventListener(EVENTS.REFRESH_PROJECT_MUSIC, handleRefresh);
            window.removeEventListener(EVENTS.MUSIC_LIST_UPDATED, handleRefresh);
        };
    }, [refreshExpandedMusicDetails]);

    useEffect(() => {
        musicList.forEach((music) => {
            const previousStatus = previousStatusRef.current[music.id];
            if (previousStatus === "GENERATING" && music.status === "IDLE") {
                toast("Music version completed", "success");
            }
            previousStatusRef.current[music.id] = music.status;
        });
    }, [musicList]);

    useEffect(() => {
        if (expandedMusicIds.size === 0) {
            return;
        }
        const shouldPoll = musicList.some((music) => music.status === "GENERATING");
        if (!shouldPoll) {
            return;
        }
        const intervalId = window.setInterval(() => {
            refreshExpandedMusicDetails();
        }, 5000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [expandedMusicIds, musicList, refreshExpandedMusicDetails]);

    const handleDragStart = (event: React.DragEvent, versionId: string) => {
        event.stopPropagation();
        event.dataTransfer.setData("application/x-loopbox", JSON.stringify({ type: "music-version", id: versionId }));
        event.dataTransfer.setData("text/plain", `music-version:${versionId}`);
        setDragPayload({ type: "music-version", id: versionId });
        event.dataTransfer.effectAllowed = "copy";
    };

    const handleDelete = async (musicId: string) => {
        if (!window.confirm("Are you sure you want to delete this music?")) {
            return;
        }

        try {
            await musicApi.delete(projectId, musicId);
            window.dispatchEvent(new Event(EVENTS.REFRESH_PROJECT_MUSIC));
            window.dispatchEvent(new Event(EVENTS.REFRESH_SIDEBAR));
        } catch (error) {
            console.error("Failed to delete music:", error);
            toast("Failed to delete music", "error");
        }
    };

    const startEditing = (music: Music) => {
        setEditingMusicId(music.id);
        setEditingAlias(music.alias ?? "");
    };

    const cancelEditing = () => {
        setEditingMusicId(null);
        setEditingAlias("");
    };

    const handleSave = async (musicId: string) => {
        setIsSaving(true);
        try {
            await musicApi.update(projectId, musicId, { alias: editingAlias });
            cancelEditing();
            window.dispatchEvent(new Event(EVENTS.REFRESH_PROJECT_MUSIC));
            window.dispatchEvent(new Event(EVENTS.REFRESH_SIDEBAR));
            toast("Alias updated", "success");
        } catch (error) {
            console.error("Failed to update music alias:", error);
            toast("Failed to update music alias", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleVersions = async (musicId: string) => {
        setExpandedMusicIds((prev) => {
            const next = new Set(prev);
            if (next.has(musicId)) {
                next.delete(musicId);
            } else {
                next.add(musicId);
            }
            return next;
        });
        if (!musicDetails[musicId]) {
            setLoadingVersions((prev) => new Set(prev).add(musicId));
            try {
                const response = await musicApi.get(projectId, musicId);
                setMusicDetails((prev) => ({
                    ...prev,
                    [musicId]: { versions: response.versions },
                }));
            } catch (error) {
                console.error("Failed to fetch music versions:", error);
                toast("Failed to load music versions", "error");
            } finally {
                setLoadingVersions((prev) => {
                    const next = new Set(prev);
                    next.delete(musicId);
                    return next;
                });
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Musics</h2>
                <Link href={`/project/${projectId}/music/new`}>
                    <Button>Create Music</Button>
                </Link>
            </div>
            {musicList.length === 0 ? (
                <Card>
                    <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
                        No music created yet.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {musicList.map((music) => (
                        <Card
                            key={music.id}
                            className="transition-all hover:border-primary/50 hover:shadow-md"
                        >
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => toggleVersions(music.id)}
                                        title="Toggle versions"
                                    >
                                        {expandedMusicIds.has(music.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </Button>
                                    {editingMusicId === music.id ? (
                                        <>
                                            <Input
                                                value={editingAlias}
                                                onChange={(e) => setEditingAlias(e.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        handleSave(music.id);
                                                    }
                                                    if (event.key === "Escape") {
                                                        event.preventDefault();
                                                        cancelEditing();
                                                    }
                                                }}
                                                className="h-8 w-48"
                                                placeholder="Alias"
                                                disabled={isSaving}
                                            />
                                            <Badge variant={getStatusBadgeVariant(music.status)}>
                                                {music.status}
                                            </Badge>
                                        </>
                                    ) : (
                                        <>
                                            <CardTitle className="text-lg font-medium">
                                                {getMusicDisplayName(music, { prefix: "Music" })}
                                            </CardTitle>
                                            <Badge variant={getStatusBadgeVariant(music.status)}>
                                                {music.status}
                                            </Badge>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {editingMusicId === music.id ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSave(music.id)}
                                                disabled={isSaving}
                                            >
                                                {isSaving ? null : <Check className="mr-1 h-4 w-4" />}
                                                Save
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={cancelEditing}
                                                disabled={isSaving}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => startEditing(music)}
                                                title="Edit alias"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Link href={`/project/${projectId}/music/${music.id}`}>
                                                <Button variant="outline" size="sm">
                                                    View Details
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => music.status !== 'GENERATING' && handleDelete(music.id)}
                                                disabled={music.status === 'GENERATING'}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {expandedMusicIds.has(music.id) ? (
                                        loadingVersions.has(music.id) ? (
                                            <div className="text-sm text-muted-foreground">Loading versions...</div>
                                        ) : musicDetails[music.id]?.versions?.length ? (
                                            <div className="space-y-2">
                                                {musicDetails[music.id].versions.map((version) => (
                                                    <div
                                                        key={version.id}
                                                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
                                                        draggable
                                                        onDragStart={(event) => handleDragStart(event, version.id)}
                                                        onDragEnd={clearDragPayload}
                                                    >
                                                        <div className="text-muted-foreground">
                                                            Version {version.id.slice(0, 8)}
                                                        </div>
                                                        <div className="text-muted-foreground">
                                                            {version.durationSeconds ?? 0}s
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">No versions yet.</div>
                                        )
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
