"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { projectApi, musicApi, imageApi } from "@/lib/api";
import type { Image, Music, Project } from "@/lib/api-types";
import { MusicList } from "@/components/music-list";
import { ImageList } from "@/components/image-list";
import { ProjectTitleEditor } from "@/components/project-title-editor";
import { VideoEditor } from "@/components/video-editor";
import { AUTH_EVENT_NAME, AUTH_STORAGE_KEY, loadAuthState } from "@/lib/auth";
import { EVENTS } from "@/lib/events";

export default function ProjectPage() {
    const params = useParams<{ id: string }>();
    const projectId = params?.id;

    const [project, setProject] = useState<Project | null>(null);
    const [musicList, setMusicList] = useState<Music[]>([]);
    const [images, setImages] = useState<Image[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);

    const refreshProjectData = async () => {
        if (!projectId) return;
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [projectRes, musicRes, imageRes] = await Promise.all([
                projectApi.get(projectId),
                musicApi.getList(projectId),
                imageApi.getList(projectId),
            ]);
            setProject(projectRes.project);
            setMusicList(musicRes.musicList);
            setImages(imageRes.images);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event(EVENTS.MUSIC_LIST_UPDATED));
                window.dispatchEvent(new Event(EVENTS.IMAGE_LIST_UPDATED));
            }
        } catch (error) {
            console.error("Failed to fetch project details", error);
            setErrorMessage("Failed to load this project. Check the backend connection or ID.");
        } finally {
            setIsLoading(false);
        }
    };

    const refreshMusicList = async () => {
        if (!projectId || !isAuthed) return;
        try {
            const musicRes = await musicApi.getList(projectId);
            setMusicList(musicRes.musicList);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event(EVENTS.MUSIC_LIST_UPDATED));
            }
        } catch (error) {
            console.error("Failed to refresh music list", error);
        }
    };

    const refreshImageList = async () => {
        if (!projectId || !isAuthed) return;
        try {
            const imageRes = await imageApi.getList(projectId);
            setImages(imageRes.images);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event(EVENTS.IMAGE_LIST_UPDATED));
            }
        } catch (error) {
            console.error("Failed to refresh image list", error);
        }
    };

    useEffect(() => {
        const handleAuthChange = () => {
            const auth = loadAuthState();
            if (!auth) {
                setIsAuthed(false);
                setProject(null);
                setMusicList([]);
                setImages([]);
                setIsLoading(false);
                return;
            }
            setIsAuthed(true);
            refreshProjectData();
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
    }, [projectId]);

    useEffect(() => {
        const handleRefresh = () => {
            refreshMusicList();
        };
        window.addEventListener(EVENTS.REFRESH_PROJECT_MUSIC, handleRefresh);
        return () => {
            window.removeEventListener(EVENTS.REFRESH_PROJECT_MUSIC, handleRefresh);
        };
    }, [projectId, isAuthed]);

    useEffect(() => {
        const handleRefresh = () => {
            refreshImageList();
        };
        window.addEventListener(EVENTS.REFRESH_PROJECT_IMAGES, handleRefresh);
        return () => {
            window.removeEventListener(EVENTS.REFRESH_PROJECT_IMAGES, handleRefresh);
        };
    }, [projectId, isAuthed]);

    useEffect(() => {
        if (!projectId || !isAuthed) return;
        const shouldPoll =
            musicList.some((music) => music.status === "GENERATING") ||
            images.some((image) => image.status === "GENERATING" || image.status === "DELETING");
        if (!shouldPoll) return;

        const intervalId = window.setInterval(() => {
            refreshMusicList();
            refreshImageList();
        }, 5000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [projectId, isAuthed, musicList, images]);

    if (!projectId) {
        return null;
    }

    if (!isAuthed && !isLoading) {
        return (
            <main className="flex min-h-screen flex-col p-8 md:p-24">
                <div className="mb-8 space-y-4">
                    <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Projects
                    </Link>
                    <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        You need to log in to view this project.{" "}
                        <Link className="text-primary hover:underline" href="/auth/login">
                            Go to login
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!project && !isLoading) {
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
                {project && <ProjectTitleEditor project={project} />}
            </div>

            {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading project...</div>
            ) : (
                <div className="space-y-10">
                    <VideoEditor projectId={projectId} />
                    <MusicList projectId={projectId} musicList={musicList} />
                    <ImageList projectId={projectId} images={images} />
                </div>
            )}
        </main>
    );
}
