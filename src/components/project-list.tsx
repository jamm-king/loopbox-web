"use client";

import type { MouseEvent } from "react";

import { Project } from "@/lib/api-types";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { projectApi } from "@/lib/api";
import { EVENTS } from "@/lib/events";

interface ProjectListProps {
    projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
    const handleDelete = async (e: MouseEvent<HTMLButtonElement>, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!window.confirm("Are you sure you want to delete this project?")) {
            return;
        }

        try {
            await projectApi.delete(projectId);
            window.dispatchEvent(new Event(EVENTS.REFRESH_PROJECTS));
            window.dispatchEvent(new Event(EVENTS.REFRESH_SIDEBAR));
        } catch (error) {
            console.error("Failed to delete project:", error);
            alert("Failed to delete project");
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/project/new" className="group relative flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-accent/5">
                <div className="flex flex-col items-center gap-2 text-muted-foreground transition-colors group-hover:text-foreground">
                    <Plus className="h-8 w-8" />
                    <span className="font-medium">Create Project</span>
                </div>
            </Link>
            {projects.map((project) => (
                <Link key={project.id} href={`/project/${project.id}`} className="block relative group">
                    <Card className="h-48 transition-all hover:shadow-md hover:border-primary/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg font-medium text-primary flex-1 truncate pr-8">
                                {project.title}
                            </CardTitle>
                            <Badge variant={project.status === 'COMPLETED' ? 'default' : 'secondary'} className="shrink-0">
                                {project.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                ID: {project.id.slice(0, 8)}...
                            </p>
                        </CardContent>
                    </Card>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:text-destructive"
                        onClick={(e) => handleDelete(e, project.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </Link>
            ))}
        </div>
    );
}
