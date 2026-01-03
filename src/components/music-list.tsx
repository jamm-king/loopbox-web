"use client";

import { Music } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { musicApi } from "@/lib/api";
import { useRouter } from "next/navigation";

interface MusicListProps {
    projectId: string;
    musicList: Music[];
}

export function MusicList({ projectId, musicList }: MusicListProps) {
    const router = useRouter();

    const handleDelete = async (musicId: string) => {
        if (!window.confirm("Are you sure you want to delete this music?")) {
            return;
        }

        try {
            await musicApi.delete(projectId, musicId);
            router.refresh();
            window.dispatchEvent(new Event('refresh-sidebar'));
        } catch (error) {
            console.error("Failed to delete music:", error);
            alert("Failed to delete music");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Music</h2>
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
                        <Card key={music.id} className="transition-all hover:border-primary/50 hover:shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg font-medium">
                                        Music {music.id.slice(0, 8)}
                                    </CardTitle>
                                    <Badge variant={music.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                        {music.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
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
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="text-sm text-muted-foreground">
                                        Click details to see versions
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
