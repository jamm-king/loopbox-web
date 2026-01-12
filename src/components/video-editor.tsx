"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { videoApi, musicApi, imageApi } from "@/lib/api";
import type { Image, ImageVersion, Music, MusicVersion, Video } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
    getImageGroupDurationSeconds,
    getImageGroupStartSeconds,
    getTotalDurationSeconds,
} from "@/lib/video-timeline";
import { Check, Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

type MusicVersionItem = MusicVersion & { musicId: string; musicAlias?: string | null };
type ImageVersionItem = ImageVersion & { imageId: string };

interface VideoEditorProps {
    projectId: string;
}

interface DraftSegment {
    musicVersionId: string;
    musicId: string;
    durationSeconds: number;
}

interface DraftImageGroup {
    imageVersionId: string;
    imageId: string;
    segmentIndexStart: number;
    segmentIndexEnd: number;
}

const dragMimeType = "application/x-loopbox";

const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const parseDragPayload = (event: React.DragEvent) => {
    const payload = event.dataTransfer.getData(dragMimeType);
    if (payload) {
        try {
            return JSON.parse(payload) as { type: string; id: string };
        } catch {
            return null;
        }
    }
    const fallback = event.dataTransfer.getData("text/plain");
    if (!fallback) {
        return null;
    }
    const [type, id] = fallback.split(":");
    if (!type || !id) {
        return null;
    }
    return { type, id };
};

export function VideoEditor({ projectId }: VideoEditorProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [video, setVideo] = useState<Video | null>(null);
    const [segments, setSegments] = useState<DraftSegment[]>([]);
    const [imageGroups, setImageGroups] = useState<DraftImageGroup[]>([]);
    const [musicVersions, setMusicVersions] = useState<MusicVersionItem[]>([]);
    const [imageVersions, setImageVersions] = useState<ImageVersionItem[]>([]);
    const [selectedMusicVersionId, setSelectedMusicVersionId] = useState("");
    const [selectedImageVersionId, setSelectedImageVersionId] = useState("");
    const [groupStartIndex, setGroupStartIndex] = useState("");
    const [groupEndIndex, setGroupEndIndex] = useState("");
    const [dropHint, setDropHint] = useState<string | null>(null);
    const musicTimelineRef = useRef<HTMLDivElement | null>(null);
    const imageTimelineRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            setIsLoading(true);
            try {
                const [videoResponse, musicListResponse, imageListResponse] = await Promise.all([
                    videoApi.get(projectId),
                    musicApi.getList(projectId),
                    imageApi.getList(projectId),
                ]);

                const musicDetails = await Promise.all(
                    musicListResponse.musicList.map(async (music: Music) => {
                        const detail = await musicApi.get(projectId, music.id);
                        return detail;
                    })
                );
                const musicVersionItems = musicDetails.flatMap((detail) =>
                    detail.versions.map((version) => ({
                        ...version,
                        musicId: detail.music.id,
                        musicAlias: detail.music.alias,
                    }))
                );

                const imageDetails = await Promise.all(
                    imageListResponse.images.map(async (image: Image) => {
                        const detail = await imageApi.get(projectId, image.id);
                        return detail;
                    })
                );
                const imageVersionItems = imageDetails.flatMap((detail) =>
                    detail.versions.map((version) => ({
                        ...version,
                        imageId: detail.image.id,
                    }))
                );

                if (!isMounted) {
                    return;
                }

                setVideo(videoResponse.video);
                setSegments(
                    videoResponse.video.segments.map((segment) => ({
                        musicVersionId: segment.musicVersionId,
                        musicId: segment.musicId,
                        durationSeconds: segment.durationSeconds,
                    }))
                );
                setImageGroups(
                    videoResponse.video.imageGroups.map((group) => ({
                        imageVersionId: group.imageVersionId,
                        imageId: group.imageId,
                        segmentIndexStart: group.segmentIndexStart,
                        segmentIndexEnd: group.segmentIndexEnd,
                    }))
                );
                setMusicVersions(musicVersionItems);
                setImageVersions(imageVersionItems);
            } catch (error) {
                console.error("Failed to load video editor data:", error);
                toast("Failed to load video editor data", "error");
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        load();
        return () => {
            isMounted = false;
        };
    }, [projectId]);

    const totalDuration = useMemo(
        () => getTotalDurationSeconds(segments),
        [segments]
    );

    const isRangeAvailable = (start: number, end: number) =>
        !imageGroups.some(
            (group) =>
                !(end < group.segmentIndexStart || start > group.segmentIndexEnd)
        );

    const getInsertIndexByPosition = (event: React.DragEvent, container: HTMLDivElement | null) => {
        if (!container) {
            return segments.length;
        }
        const rect = container.getBoundingClientRect();
        const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        if (totalDuration <= 0) {
            return segments.length;
        }
        const target = (x / rect.width) * totalDuration;
        let cursor = 0;
        for (let i = 0; i < segments.length; i += 1) {
            cursor += segments[i].durationSeconds || 0;
            if (target <= cursor) {
                return i;
            }
        }
        return segments.length;
    };

    const handleAddSegment = () => {
        const version = musicVersions.find((item) => item.id === selectedMusicVersionId);
        if (!version) {
            toast("Select a music version to add", "error");
            return;
        }
        setSegments((prev) => [
            ...prev,
            {
                musicVersionId: version.id,
                musicId: version.musicId,
                durationSeconds: version.durationSeconds ?? 0,
            },
        ]);
        setSelectedMusicVersionId("");
    };

    const moveSegment = (index: number, direction: "up" | "down") => {
        setSegments((prev) => {
            const next = [...prev];
            const target = direction === "up" ? index - 1 : index + 1;
            if (target < 0 || target >= next.length) {
                return prev;
            }
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const removeSegment = (index: number) => {
        setSegments((prev) => prev.filter((_, i) => i !== index));
        setImageGroups((prev) =>
            prev
                .filter(
                    (group) =>
                        !(index >= group.segmentIndexStart && index <= group.segmentIndexEnd)
                )
                .map((group) => {
                    const start = group.segmentIndexStart > index ? group.segmentIndexStart - 1 : group.segmentIndexStart;
                    const end = group.segmentIndexEnd > index ? group.segmentIndexEnd - 1 : group.segmentIndexEnd;
                    return { ...group, segmentIndexStart: start, segmentIndexEnd: end };
                })
        );
    };

    const addSegmentByVersion = (versionId: string, insertIndex: number) => {
        const version = musicVersions.find((item) => item.id === versionId);
        if (!version) {
            toast("Music version not found", "error");
            return;
        }
        setSegments((prev) => {
            const next = [...prev];
            next.splice(insertIndex, 0, {
                musicVersionId: version.id,
                musicId: version.musicId,
                durationSeconds: version.durationSeconds ?? 0,
            });
            return next;
        });
    };

    const addImageGroupRange = (versionId: string, start: number, end: number) => {
        if (start < 0 || end < 0 || start > end || end >= segments.length) {
            toast("Segment range is invalid", "error");
            return;
        }
        if (!isRangeAvailable(start, end)) {
            toast("Image group overlaps an existing range", "error");
            return;
        }
        const version = imageVersions.find((item) => item.id === versionId);
        if (!version) {
            toast("Image version not found", "error");
            return;
        }
        setImageGroups((prev) => [
            ...prev,
            {
                imageVersionId: version.id,
                imageId: version.imageId,
                segmentIndexStart: start,
                segmentIndexEnd: end,
            },
        ]);
    };

    const addImageGroupForSegment = (versionId: string, segmentIndex: number) =>
        addImageGroupRange(versionId, segmentIndex, segmentIndex);

    const handleDropMusic = (event: React.DragEvent, insertIndex: number) => {
        event.preventDefault();
        setDropHint(null);
        const payload = parseDragPayload(event);
        if (!payload || payload.type !== "music-version") {
            return;
        }
        addSegmentByVersion(payload.id, insertIndex);
    };

    const handleDropImage = (event: React.DragEvent, segmentIndex: number) => {
        event.preventDefault();
        setDropHint(null);
        const payload = parseDragPayload(event);
        if (!payload || payload.type !== "image-version") {
            return;
        }
        addImageGroupForSegment(payload.id, segmentIndex);
    };

    const handleDropOnSegmentRow = (event: React.DragEvent, index: number) => {
        event.preventDefault();
        setDropHint(null);
        const payload = parseDragPayload(event);
        if (!payload) {
            return;
        }
        if (payload.type === "music-version") {
            addSegmentByVersion(payload.id, index);
        }
        if (payload.type === "image-version") {
            addImageGroupForSegment(payload.id, index);
        }
    };

    const handleAddImageGroup = () => {
        const version = imageVersions.find((item) => item.id === selectedImageVersionId);
        if (!version) {
            toast("Select an image version to map", "error");
            return;
        }
        const start = Number.parseInt(groupStartIndex, 10);
        const end = Number.parseInt(groupEndIndex, 10);
        if (Number.isNaN(start) || Number.isNaN(end)) {
            toast("Select start and end segments", "error");
            return;
        }
        if (start < 0 || end < 0 || start > end || end >= segments.length) {
            toast("Segment range is invalid", "error");
            return;
        }
        if (!isRangeAvailable(start, end)) {
            toast("Image group overlaps an existing range", "error");
            return;
        }

        addImageGroupRange(version.id, start, end);
        setSelectedImageVersionId("");
        setGroupStartIndex("");
        setGroupEndIndex("");
    };

    const removeImageGroup = (index: number) => {
        setImageGroups((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await videoApi.update(projectId, {
                segments: segments.map((segment) => ({
                    musicVersionId: segment.musicVersionId,
                })),
                imageGroups: imageGroups.map((group) => ({
                    imageVersionId: group.imageVersionId,
                    segmentIndexStart: group.segmentIndexStart,
                    segmentIndexEnd: group.segmentIndexEnd,
                })),
            });
            setVideo(response.video);
            setSegments(
                response.video.segments.map((segment) => ({
                    musicVersionId: segment.musicVersionId,
                    musicId: segment.musicId,
                    durationSeconds: segment.durationSeconds,
                }))
            );
            setImageGroups(
                response.video.imageGroups.map((group) => ({
                    imageVersionId: group.imageVersionId,
                    imageId: group.imageId,
                    segmentIndexStart: group.segmentIndexStart,
                    segmentIndexEnd: group.segmentIndexEnd,
                }))
            );
            toast("Video timeline saved", "success");
        } catch (error) {
            console.error("Failed to save video timeline:", error);
            toast("Failed to save video timeline", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRender = async () => {
        setIsRendering(true);
        try {
            const response = await videoApi.render(projectId);
            setVideo(response.video);
            toast("Video render completed", "success");
        } catch (error) {
            console.error("Failed to render video:", error);
            toast("Failed to render video", "error");
        } finally {
            setIsRendering(false);
        }
    };

    const renderSegmentBar = () => {
        if (segments.length === 0 || totalDuration === 0) {
            return (
                <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Add music segments to build your video timeline.
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div
                    ref={musicTimelineRef}
                    className={`flex h-10 w-full overflow-hidden rounded-md border border-border ${
                        dropHint === "music-timeline" ? "ring-2 ring-primary/40" : ""
                    }`}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDropHint("music-timeline");
                    }}
                    onDragLeave={() => setDropHint(null)}
                    onDrop={(event) =>
                        handleDropMusic(event, getInsertIndexByPosition(event, musicTimelineRef.current))
                    }
                >
                    {segments.map((segment, index) => {
                        const width = Math.max(4, (segment.durationSeconds / totalDuration) * 100);
                        const label = musicVersions.find((item) => item.id === segment.musicVersionId);
                        const title = label?.musicAlias?.trim()
                            ? label.musicAlias
                            : label?.musicId ?? segment.musicId;
                        return (
                            <div
                                key={`${segment.musicVersionId}-${index}`}
                                className="flex h-full items-center justify-center border-r border-border bg-muted text-xs text-muted-foreground"
                                style={{ width: `${width}%` }}
                                title={title}
                            >
                                {formatDuration(segment.durationSeconds)}
                            </div>
                        );
                    })}
                </div>

                <div
                    ref={imageTimelineRef}
                    className={`relative h-10 w-full overflow-hidden rounded-md border border-border bg-background ${
                        dropHint === "image-timeline" ? "ring-2 ring-amber-300" : ""
                    }`}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDropHint("image-timeline");
                    }}
                    onDragLeave={() => setDropHint(null)}
                    onDrop={(event) => {
                        if (segments.length === 0) {
                            toast("Add music segments first", "error");
                            return;
                        }
                        const index = getInsertIndexByPosition(event, imageTimelineRef.current);
                        handleDropImage(event, Math.min(index, segments.length - 1));
                    }}
                >
                    {imageGroups.map((group, index) => {
                        const duration = getImageGroupDurationSeconds(group, segments);
                        const start = getImageGroupStartSeconds(group, segments);
                        const width = totalDuration ? Math.max(4, (duration / totalDuration) * 100) : 0;
                        const offset = totalDuration ? (start / totalDuration) * 100 : 0;
                        return (
                            <div
                                key={`${group.imageVersionId}-${index}`}
                                className="absolute top-0 h-10 rounded-md bg-amber-200/70 text-xs text-amber-900"
                                style={{ width: `${width}%`, left: `${offset}%` }}
                                title={`Image ${group.imageId}`}
                            >
                                <div className="flex h-full items-center justify-center">
                                    Img {group.imageId.slice(0, 6)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Video Editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading video timeline...
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Total Duration: {formatDuration(totalDuration)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Status: {video?.status ?? "DRAFT"}
                                </div>
                            </div>
                            {renderSegmentBar()}
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">Music Segments</h3>
                                    <div
                                        className="flex items-center gap-2"
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setDropHint("segments-list");
                                        }}
                                        onDragLeave={() => setDropHint(null)}
                                        onDrop={(event) => handleDropMusic(event, segments.length)}
                                    >
                                        <Select value={selectedMusicVersionId} onValueChange={setSelectedMusicVersionId}>
                                            <SelectTrigger className="w-56">
                                                <SelectValue placeholder="Select music version" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {musicVersions.map((version) => (
                                                    <SelectItem key={version.id} value={version.id}>
                                                        {version.musicAlias?.trim()
                                                            ? `${version.musicAlias} (${version.id.slice(0, 6)})`
                                                            : `Music ${version.musicId.slice(0, 6)} (${version.id.slice(0, 6)})`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button onClick={handleAddSegment} size="sm">
                                            <Plus className="mr-1 h-4 w-4" />
                                            Add
                                        </Button>
                                    </div>
                                </div>
                                {segments.length === 0 ? (
                                    <div
                                        className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground"
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setDropHint("segments-list");
                                        }}
                                        onDragLeave={() => setDropHint(null)}
                                        onDrop={(event) => handleDropMusic(event, segments.length)}
                                    >
                                        No segments yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {segments.map((segment, index) => (
                                            <div
                                                key={`${segment.musicVersionId}-${index}`}
                                                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                                                onDragOver={(event) => {
                                                    event.preventDefault();
                                                    setDropHint("segment-row");
                                                }}
                                                onDragLeave={() => setDropHint(null)}
                                                onDrop={(event) => handleDropOnSegmentRow(event, index)}
                                            >
                                                <div className="space-y-1">
                                                    <div className="font-medium">
                                                        Segment {index + 1}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Music {segment.musicId.slice(0, 6)} · {formatDuration(segment.durationSeconds)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => moveSegment(index, "up")}
                                                        disabled={index === 0}
                                                    >
                                                        <ArrowUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => moveSegment(index, "down")}
                                                        disabled={index === segments.length - 1}
                                                    >
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeSegment(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold">Image Groups</h3>
                                    <div className="flex flex-wrap items-center gap-2">
                                    <Select value={selectedImageVersionId} onValueChange={setSelectedImageVersionId}>
                                        <SelectTrigger className="w-56">
                                            <SelectValue placeholder="Select image version" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {imageVersions.map((version) => (
                                                <SelectItem key={version.id} value={version.id}>
                                                    Image {version.imageId.slice(0, 6)} ({version.id.slice(0, 6)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={groupStartIndex} onValueChange={setGroupStartIndex}>
                                        <SelectTrigger className="w-44">
                                            <SelectValue placeholder="Start segment" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {segments.map((segment, index) => {
                                                const label = musicVersions.find(
                                                    (item) => item.id === segment.musicVersionId
                                                );
                                                const name = label?.musicAlias?.trim()
                                                    ? label.musicAlias
                                                    : label?.musicId ?? segment.musicId;
                                                return (
                                                    <SelectItem key={`start-${index}`} value={index.toString()}>
                                                        {index + 1}. {name.slice(0, 12)}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <Select value={groupEndIndex} onValueChange={setGroupEndIndex}>
                                        <SelectTrigger className="w-44">
                                            <SelectValue placeholder="End segment" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {segments.map((segment, index) => {
                                                const label = musicVersions.find(
                                                    (item) => item.id === segment.musicVersionId
                                                );
                                                const name = label?.musicAlias?.trim()
                                                    ? label.musicAlias
                                                    : label?.musicId ?? segment.musicId;
                                                return (
                                                    <SelectItem key={`end-${index}`} value={index.toString()}>
                                                        {index + 1}. {name.slice(0, 12)}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleAddImageGroup} size="sm">
                                        <Plus className="mr-1 h-4 w-4" />
                                        Add
                                    </Button>
                                    </div>
                                </div>

                                {imageGroups.length === 0 ? (
                                    <div
                                        className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground"
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setDropHint("image-group-list");
                                        }}
                                        onDragLeave={() => setDropHint(null)}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            const payload = parseDragPayload(event);
                                            if (!payload || payload.type !== "image-version") {
                                                return;
                                            }
                                            if (!groupStartIndex || !groupEndIndex) {
                                                toast("Select start and end segments first", "error");
                                                return;
                                            }
                                            const start = Number.parseInt(groupStartIndex, 10);
                                            const end = Number.parseInt(groupEndIndex, 10);
                                            if (Number.isNaN(start) || Number.isNaN(end)) {
                                                toast("Segment range is invalid", "error");
                                                return;
                                            }
                                            if (!isRangeAvailable(start, end)) {
                                                toast("Image group overlaps an existing range", "error");
                                                return;
                                            }
                                            addImageGroupRange(payload.id, start, end);
                                        }}
                                    >
                                        No image groups yet.
                                    </div>
                                ) : (
                                    <div
                                        className="space-y-2"
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            setDropHint("image-group-list");
                                        }}
                                        onDragLeave={() => setDropHint(null)}
                                        onDrop={(event) => {
                                            const payload = parseDragPayload(event);
                                            if (!payload || payload.type !== "image-version") {
                                                return;
                                            }
                                            if (!groupStartIndex || !groupEndIndex) {
                                                toast("Select start and end segments first", "error");
                                                return;
                                            }
                                            const start = Number.parseInt(groupStartIndex, 10);
                                            const end = Number.parseInt(groupEndIndex, 10);
                                            if (Number.isNaN(start) || Number.isNaN(end)) {
                                                toast("Segment range is invalid", "error");
                                                return;
                                            }
                                            if (!isRangeAvailable(start, end)) {
                                                toast("Image group overlaps an existing range", "error");
                                                return;
                                            }
                                            addImageGroupRange(payload.id, start, end);
                                        }}
                                    >
                                        {imageGroups.map((group, index) => (
                                            <div
                                                key={`${group.imageVersionId}-${index}`}
                                                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                                                onDragOver={(event) => {
                                                    event.preventDefault();
                                                    setDropHint("segment-row");
                                                }}
                                                onDragLeave={() => setDropHint(null)}
                                                onDrop={(event) => {
                                                    event.preventDefault();
                                                    const payload = parseDragPayload(event);
                                                    if (!payload || payload.type !== "image-version") {
                                                        return;
                                                    }
                                                    addImageGroupForSegment(payload.id, group.segmentIndexStart);
                                                }}
                                            >
                                                <div className="space-y-1">
                                                    <div className="font-medium">
                                                        Image {group.imageId.slice(0, 6)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Segments {group.segmentIndexStart + 1} - {group.segmentIndexEnd + 1}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeImageGroup(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                )}
                                Save Timeline
                            </Button>
                            <Button onClick={handleRender} disabled={isRendering || segments.length === 0}>
                                {isRendering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Render Video
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
