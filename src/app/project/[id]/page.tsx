import { projectApi, musicApi, imageApi } from "@/lib/api";
import type { Image, Music, Project } from "@/lib/api-types";
import { MusicList } from "@/components/music-list";
import { ImageList } from "@/components/image-list";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ProjectPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
    const { id } = await params;

    let project: Project | null = null;
    let musicList: Music[] = [];
    let images: Image[] = [];
    let errorMessage: string | null = null;

    try {
        project = (await projectApi.get(id)).project;
        musicList = (await musicApi.getList(id)).musicList;
        images = (await imageApi.getList(id)).images;
    } catch (e) {
        console.error("Failed to fetch project details", e);
        errorMessage = "Failed to load this project. Check the backend connection or ID.";
    }

    if (!project) {
        return (
            <main className="flex min-h-screen flex-col p-8 md:p-24">
                <div className="mb-8 space-y-4">
                    <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Projects
                    </Link>
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                        {errorMessage ?? "Project not found."}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col p-8 md:p-24">
            <div className="mb-8 space-y-4">
                <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Projects
                </Link>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-bold tracking-tight">{project.title}</h1>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span>ID: {project.id}</span>
                            <Badge variant={project.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                {project.status}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                <MusicList projectId={id} musicList={musicList} />
                <ImageList projectId={id} images={images} />
            </div>
        </main>
    );
}
