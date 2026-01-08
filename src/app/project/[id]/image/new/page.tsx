"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { imageApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function CreateImagePage() {
    const router = useRouter();
    const { id: projectId } = useParams<{ id: string }>();
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!projectId) {
            return;
        }

        setIsLoading(true);
        try {
            const res = await imageApi.create(projectId);
            router.push(`/project/${projectId}/image/${res.image.id}`);
            router.refresh();
            window.dispatchEvent(new Event("refresh-sidebar"));
        } catch (error) {
            console.error("Failed to create image", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Create New Image</CardTitle>
                    <CardDescription>
                        Initialize a new image entity for this project.
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={isLoading || !projectId}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Image
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
