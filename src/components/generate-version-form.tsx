"use client";

import { useState, type FormEvent } from "react";
import { musicApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface GenerateVersionFormProps {
    projectId: string;
    musicId: string;
    isMusicGenerating?: boolean;
    onStartGenerating?: () => void;
    onGenerated?: (status: string) => void;
    onGenerationFailed?: () => void;
}

export function GenerateVersionForm({
    projectId,
    musicId,
    isMusicGenerating = false,
    onStartGenerating,
    onGenerated,
    onGenerationFailed,
}: GenerateVersionFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [provider, setProvider] = useState("SUNO");
    const [mood, setMood] = useState("");
    const [bpm, setBpm] = useState("");
    const [melody, setMelody] = useState("");
    const [harmony, setHarmony] = useState("");
    const [bass, setBass] = useState("");
    const [beat, setBeat] = useState("");

    const handleGenerate = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        onStartGenerating?.();
        try {
            const response = await musicApi.generateVersion(projectId, musicId, {
                provider,
                mood: mood || undefined,
                bpm: bpm ? parseInt(bpm) : undefined,
                melody: melody || undefined,
                harmony: harmony || undefined,
                bass: bass || undefined,
                beat: beat || undefined,
            });
            onGenerated?.(response.music.status);
        } catch (error) {
            console.error("Failed to generate version", error);
            onGenerationFailed?.();
        } finally {
            setIsLoading(false);
        }
    };

    const isGenerating = isLoading || isMusicGenerating;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generate New Version</CardTitle>
                <CardDescription>Create a new version of this music.</CardDescription>
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
                                <SelectItem value="SUNO">Suno AI</SelectItem>
                                {/* Add other providers here if available */}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="mood">Mood</Label>
                            <Input
                                id="mood"
                                placeholder="e.g., Happy, Dark"
                                value={mood}
                                onChange={(e) => setMood(e.target.value)}
                                disabled={isGenerating}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bpm">BPM</Label>
                            <Input
                                id="bpm"
                                type="number"
                                placeholder="e.g., 120"
                                value={bpm}
                                onChange={(e) => setBpm(e.target.value)}
                                disabled={isGenerating}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="melody">Melody</Label>
                        <Input
                            id="melody"
                            placeholder="Describe the melody..."
                            value={melody}
                            onChange={(e) => setMelody(e.target.value)}
                            disabled={isGenerating}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="harmony">Harmony</Label>
                        <Input
                            id="harmony"
                            placeholder="Describe the harmony..."
                            value={harmony}
                            onChange={(e) => setHarmony(e.target.value)}
                            disabled={isGenerating}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bass">Bass</Label>
                        <Input
                            id="bass"
                            placeholder="Describe the bass..."
                            value={bass}
                            onChange={(e) => setBass(e.target.value)}
                            disabled={isGenerating}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="beat">Beat</Label>
                        <Input
                            id="beat"
                            placeholder="Describe the beat..."
                            value={beat}
                            onChange={(e) => setBeat(e.target.value)}
                            disabled={isGenerating}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isGenerating} className="w-full">
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isGenerating ? "Generating..." : "Generate"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
