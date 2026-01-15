"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/api-types";
import { projectApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { buildProjectUpdateRequest } from "@/lib/project-update";
import { Check, Pencil, X } from "lucide-react";
import { EVENTS } from "@/lib/events";

interface ProjectTitleEditorProps {
    project: Project;
}

export function ProjectTitleEditor({ project }: ProjectTitleEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(project.title);
    const [currentTitle, setCurrentTitle] = useState(project.title);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setCurrentTitle(project.title);
        if (!isEditing) {
            setTitle(project.title);
        }
    }, [project.title, isEditing]);

    const cancelEditing = () => {
        setIsEditing(false);
        setTitle(currentTitle);
    };

    const saveTitle = async () => {
        const request = buildProjectUpdateRequest(title);
        if (!request) {
            toast("Project title cannot be empty", "error");
            return;
        }

        setIsSaving(true);
        try {
            const response = await projectApi.update(project.id, request);
            setCurrentTitle(response.project.title);
            setIsEditing(false);
            window.dispatchEvent(new Event(EVENTS.REFRESH_SIDEBAR));
            window.dispatchEvent(new Event(EVENTS.REFRESH_PROJECTS));
            toast("Project title updated", "success");
        } catch (error) {
            console.error("Failed to update project title:", error);
            toast("Failed to update project title", "error");
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
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        saveTitle();
                                    }
                                    if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelEditing();
                                    }
                                }}
                                className="h-11 w-72 text-2xl font-bold tracking-tight"
                                placeholder="Project title"
                                disabled={isSaving}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={saveTitle}
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
                            <h1 className="text-4xl font-bold tracking-tight">{currentTitle}</h1>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsEditing(true)}
                                title="Edit project title"
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span>ID: {project.id}</span>
                    <Badge variant={project.status === "COMPLETED" ? "default" : "secondary"}>
                        {project.status}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
