"use client";

import { useState } from "react";
import type { Music } from "@/lib/api-types";
import { musicApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStatusBadgeVariant } from "@/lib/status-badge";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { EVENTS } from "@/lib/events";

interface MusicAliasEditorProps {
    projectId: string;
    music: Music;
}

export function MusicAliasEditor({ projectId, music }: MusicAliasEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [alias, setAlias] = useState(music.alias ?? "");
    const [currentAlias, setCurrentAlias] = useState(music.alias ?? "");
    const [isSaving, setIsSaving] = useState(false);

    const cancelEditing = () => {
        setIsEditing(false);
        setAlias(currentAlias);
    };

    const saveAlias = async () => {
        setIsSaving(true);
        try {
            const response = await musicApi.update(projectId, music.id, { alias });
            setCurrentAlias(response.music.alias ?? "");
            setIsEditing(false);
            window.dispatchEvent(new Event(EVENTS.REFRESH_SIDEBAR));
            window.dispatchEvent(new Event(EVENTS.REFRESH_PROJECT_MUSIC));
            toast("Alias updated", "success");
        } catch (error) {
            console.error("Failed to update music alias:", error);
            toast("Failed to update music alias", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Input
                                value={alias}
                                onChange={(event) => setAlias(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        saveAlias();
                                    }
                                    if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelEditing();
                                    }
                                }}
                                className="h-11 w-72 text-2xl font-bold tracking-tight"
                                placeholder="Music alias"
                                disabled={isSaving}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={saveAlias}
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
                            <h1 className="text-4xl font-bold tracking-tight">
                                {currentAlias.trim() ? currentAlias : "Music Details"}
                            </h1>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsEditing(true)}
                                title="Edit alias"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span>ID: {music.id}</span>
                    <Badge variant={getStatusBadgeVariant(music.status)}>
                        {music.status}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
