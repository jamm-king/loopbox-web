"use client";

import { useEffect, useState, useRef, useCallback, type HTMLAttributes } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    ChevronRight,
    ChevronDown,
    Folder,
    Music as MusicIcon,
    FileAudio,
    Loader2,
    Plus,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { projectApi, musicApi } from "@/lib/api";
import { Project, Music } from "@/lib/api-types";
type SidebarProps = HTMLAttributes<HTMLDivElement>;

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const [projects, setProjects] = useState<Project[]>([]);
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

    // Project ID -> Music List
    const [projectMusic, setProjectMusic] = useState<Record<string, Music[]>>({});
    const [loadingMusic, setLoadingMusic] = useState<Set<string>>(new Set());

    // Music ID -> Music Details (reconstructed)
    const [musicDetails, setMusicDetails] = useState<Record<string, Music & { versions: import("@/lib/api-types").MusicVersion[] }>>({});
    const [loadingVersions, setLoadingVersions] = useState<Set<string>>(new Set());

    const [expandedMusic, setExpandedMusic] = useState<Set<string>>(new Set());
    const [loadingProjects, setLoadingProjects] = useState(true);

    const expandedProjectsRef = useRef(expandedProjects);
    const expandedMusicRef = useRef(expandedMusic);

    // Update refs whenever state changes
    useEffect(() => {
        expandedProjectsRef.current = expandedProjects;
    }, [expandedProjects]);

    useEffect(() => {
        expandedMusicRef.current = expandedMusic;
    }, [expandedMusic]);

    const refreshSidebar = useCallback(async () => {
        // 1. Always fetch projects to show new ones
        try {
            const response = await projectApi.getAll();
            setProjects(response.projectList);
        } catch (error) {
            console.error("Failed to fetch projects:", error);
        } finally {
            setLoadingProjects(false);
        }

        // Extract IDs from pathname
        // Format: /project/[projectId]/music/[musicId]
        const projectMatch = pathname.match(/\/project\/([^\/]+)/);
        const projectId = projectMatch ? projectMatch[1] : null;

        const musicMatch = pathname.match(/\/music\/([^\/]+)/);
        const musicId = musicMatch ? musicMatch[1] : null;

        // 2. Refresh active project's music if expanded
        if (projectId && projectId !== 'new' && expandedProjectsRef.current.has(projectId)) {
            try {
                const response = await musicApi.getList(projectId);
                setProjectMusic(prev => ({
                    ...prev,
                    [projectId]: response.musicList
                }));
            } catch (error) {
                console.error("Failed to fetch music list for active project:", error);
            }
        }

        // 3. Refresh active music details if expanded
        if (projectId && projectId !== 'new' && musicId && musicId !== 'new' && expandedMusicRef.current.has(musicId)) {
            try {
                const response = await musicApi.get(projectId, musicId);
                setMusicDetails(prev => ({
                    ...prev,
                    [musicId]: { ...response.music, versions: response.versions }
                }));
            } catch (error) {
                console.error("Failed to fetch music details for active music:", error);
            }
        }
    }, [pathname]);

    useEffect(() => {
        refreshSidebar();

        const handleRefresh = () => refreshSidebar();
        window.addEventListener('refresh-sidebar', handleRefresh);

        return () => {
            window.removeEventListener('refresh-sidebar', handleRefresh);
        };
    }, [refreshSidebar]);

    const toggleProject = async (projectId: string) => {
        const newExpanded = new Set(expandedProjects);
        if (newExpanded.has(projectId)) {
            newExpanded.delete(projectId);
            // Auto-collapse children when parent is collapsed
            if (projectMusic[projectId]) {
                setExpandedMusic(prev => {
                    const next = new Set(prev);
                    projectMusic[projectId].forEach(music => next.delete(music.id));
                    return next;
                });
            }
        } else {
            newExpanded.add(projectId);
            // Fetch music if not already loaded
            if (!projectMusic[projectId]) {
                setLoadingMusic(prev => new Set(prev).add(projectId));
                try {
                    const response = await musicApi.getList(projectId);
                    setProjectMusic(prev => ({
                        ...prev,
                        [projectId]: response.musicList
                    }));
                } catch (error) {
                    console.error("Failed to fetch music list:", error);
                } finally {
                    setLoadingMusic(prev => {
                        const next = new Set(prev);
                        next.delete(projectId);
                        return next;
                    });
                }
            }
        }
        setExpandedProjects(newExpanded);
    };

    const toggleMusic = async (projectId: string, musicId: string) => {
        const newExpanded = new Set(expandedMusic);
        if (newExpanded.has(musicId)) {
            newExpanded.delete(musicId);
        } else {
            newExpanded.add(musicId);
            // Fetch versions if not already loaded
            if (!musicDetails[musicId]) {
                setLoadingVersions(prev => new Set(prev).add(musicId));
                try {
                    const response = await musicApi.get(projectId, musicId);
                    setMusicDetails(prev => ({
                        ...prev,
                        [musicId]: { ...response.music, versions: response.versions }
                    }));
                } catch (error) {
                    console.error("Failed to fetch music details:", error);
                } finally {
                    setLoadingVersions(prev => {
                        const next = new Set(prev);
                        next.delete(musicId);
                        return next;
                    });
                }
            }
        }
        setExpandedMusic(newExpanded);
    };

    return (
        <div className={cn("fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card text-card-foreground", className)}>
            <div className="flex h-full flex-col">
                <div className="flex h-14 items-center border-b border-border px-4">
                    <Link href="/" className="flex items-center gap-2 font-semibold hover:text-primary transition-colors">
                        <span className="text-xl">Loopbox</span>
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto py-4">
                    <div className="px-2">
                        <div className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between group">
                            <Link href="/" className="hover:text-foreground transition-colors">Projects</Link>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        refreshSidebar();
                                    }}
                                    className="p-1 hover:text-foreground hover:bg-muted rounded-full transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                                <Link href="/project/new" className="p-1 hover:text-foreground hover:bg-muted rounded-full transition-colors" title="New Project">
                                    <Plus className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>
                        {loadingProjects ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {projects.map((project) => (
                                    <div key={project.id} className="select-none">
                                        <div
                                            className={cn(
                                                "group flex items-center rounded-sm text-sm hover:bg-accent hover:text-accent-foreground",
                                                pathname === `/project/${project.id}` && "bg-accent text-accent-foreground"
                                            )}
                                        >
                                            <div
                                                className="p-1.5 hover:bg-muted-foreground/10 rounded-sm cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleProject(project.id);
                                                }}
                                            >
                                                {expandedProjects.has(project.id) ? (
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </div>
                                            <Link
                                                href={`/project/${project.id}`}
                                                className="flex-1 flex items-center gap-2 py-1.5 pr-2 overflow-hidden"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                                                <span className="truncate">{project.title}</span>
                                            </Link>
                                            <Link
                                                href={`/project/${project.id}/music/new`}
                                                className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </Link>
                                        </div>

                                        {expandedProjects.has(project.id) && (
                                            <div className="ml-4 border-l border-border pl-2">
                                                {loadingMusic.has(project.id) ? (
                                                    <div className="py-2 pl-4">
                                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : projectMusic[project.id]?.length === 0 ? (
                                                    <div className="py-1 pl-6 text-xs text-muted-foreground">
                                                        No music
                                                    </div>
                                                ) : (
                                                    projectMusic[project.id]?.map((music) => (
                                                        <div key={music.id}>
                                                            <div
                                                                className={cn(
                                                                    "group flex items-center rounded-sm text-sm hover:bg-accent hover:text-accent-foreground",
                                                                    pathname === `/project/${project.id}/music/${music.id}` && "bg-accent text-accent-foreground"
                                                                )}
                                                            >
                                                                <div
                                                                    className="p-1.5 hover:bg-muted-foreground/10 rounded-sm cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleMusic(project.id, music.id);
                                                                    }}
                                                                >
                                                                    {expandedMusic.has(music.id) ? (
                                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                    ) : (
                                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                                <Link
                                                                    href={`/project/${project.id}/music/${music.id}`}
                                                                    className="flex-1 flex items-center gap-2 py-1.5 pr-2 overflow-hidden"
                                                                >
                                                                    <MusicIcon className="h-4 w-4 text-purple-500 shrink-0" />
                                                                    <span className="truncate">
                                                                        {music.id.slice(0, 8)}
                                                                    </span>
                                                                </Link>
                                                            </div>

                                                            {expandedMusic.has(music.id) && (
                                                                <div className="ml-4 border-l border-border pl-2">
                                                                    {loadingVersions.has(music.id) ? (
                                                                        <div className="py-2 pl-4">
                                                                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                                        </div>
                                                                    ) : musicDetails[music.id]?.versions?.length === 0 ? (
                                                                        <div className="py-1 pl-6 text-xs text-muted-foreground">
                                                                            No versions
                                                                        </div>
                                                                    ) : (
                                                                        musicDetails[music.id]?.versions?.map((version) => (
                                                                            <Link
                                                                                key={version.id}
                                                                                href={`/project/${project.id}/music/${music.id}?version=${version.id}`}
                                                                                className={cn(
                                                                                    "group flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground pl-6",
                                                                                )}
                                                                            >
                                                                                <FileAudio className="h-3.5 w-3.5 text-green-500" />
                                                                                <span className="truncate text-xs">
                                                                                    {version.id.slice(0, 8)}
                                                                                </span>
                                                                            </Link>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {projects.length === 0 && (
                                    <div className="px-2 text-sm text-muted-foreground">
                                        No projects found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-border p-4">
                    <p className="text-xs text-center text-muted-foreground">
                        &copy; 2025 Loopbox
                    </p>
                </div>
            </div>
        </div>
    );
}
