"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { musicApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { buildCreateMusicRequest } from "@/lib/music-create";

export default function CreateMusicPage() {
    const router = useRouter();
    const { id: projectId } = useParams<{ id: string }>();
    const [alias, setAlias] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();
        if (!projectId) {
            return;
        }

        setIsLoading(true);
        try {
            const res = await musicApi.create(projectId, buildCreateMusicRequest(alias));
            router.push(`/project/${projectId}/music/${res.music.id}`);
            router.refresh();
        } catch (error) {
            console.error("Failed to create music", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Create New Music</CardTitle>
                    <CardDescription>
                        Initialize a new music entity for this project.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleCreate}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2 text-left">
                            <Label htmlFor="alias">Alias (optional)</Label>
                            <Input
                                id="alias"
                                placeholder="Night Drive"
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-center gap-4">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => router.back()}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !projectId}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Music
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
