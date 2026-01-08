"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { imageApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface GenerateImageVersionFormProps {
    projectId: string;
    imageId: string;
    isImageGenerating?: boolean;
}

export function GenerateImageVersionForm({
    projectId,
    imageId,
    isImageGenerating = false,
}: GenerateImageVersionFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [provider, setProvider] = useState("REPLICATE_GOOGLE_IMAGEN_4");
    const [description, setDescription] = useState("");
    const [width, setWidth] = useState("");
    const [height, setHeight] = useState("");

    const handleGenerate = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await imageApi.generateVersion(projectId, imageId, {
                provider,
                description: description || undefined,
                width: width ? parseInt(width, 10) : undefined,
                height: height ? parseInt(height, 10) : undefined,
            });
            router.refresh();
        } catch (error) {
            console.error("Failed to generate image version", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generate New Version</CardTitle>
                <CardDescription>Create a new version of this image.</CardDescription>
            </CardHeader>
            <form onSubmit={handleGenerate}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="provider">AI Provider</Label>
                        <Select value={provider} onValueChange={setProvider}>
                            <SelectTrigger id="provider">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="REPLICATE_GOOGLE_IMAGEN_4">Replicate Imagen 4</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            placeholder="Describe the image..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isLoading || isImageGenerating}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="width">Width</Label>
                            <Input
                                id="width"
                                type="number"
                                placeholder="e.g., 1024"
                                value={width}
                                onChange={(e) => setWidth(e.target.value)}
                                disabled={isLoading || isImageGenerating}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="height">Height</Label>
                            <Input
                                id="height"
                                type="number"
                                placeholder="e.g., 1024"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                                disabled={isLoading || isImageGenerating}
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isLoading || isImageGenerating} className="w-full">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isImageGenerating ? "Generating..." : "Generate"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
