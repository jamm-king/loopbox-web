"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
    getInsertIndexByTime,
    getInsertOffsetPercent,
    getSegmentIndexByTime,
    mergeImageGroupsOnInsert,
    moveItemByIndex,
    moveItemByIndexReplace,
    moveImageGroupsBySlot,
    parseDragDataTransfer,
} from "@/lib/video-drop";
import { clearDragPayload, getDragPayload, setDragPayload } from "@/lib/drag-payload";
import { Check, Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { EVENTS } from "@/lib/events";

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

type DragPayload =
    | { type: "music-version"; id: string }
    | { type: "image-version"; id: string }
    | { type: "music-segment"; index: number }
    | { type: "image-group"; index: number };

type DropPreview =
    | { target: "music-timeline"; index: number; payload: DragPayload }
    | { target: "image-timeline"; index: number; payload: DragPayload }
    | { target: "segments-list"; index: number; payload: DragPayload }
    | { target: "image-group-list"; index: number; payload: DragPayload }
    | { target: "image-group-slot"; index: number; payload: DragPayload };

const dragMimeType = "application/x-loopbox";

const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const normalizeDragPayload = (payload: unknown): DragPayload | null => {
    if (!payload || typeof payload !== "object") {
        return null;
    }
    if ("type" in payload) {
        const type = payload.type;
        if (type === "music-version" || type === "image-version") {
            if ("id" in payload && typeof payload.id === "string") {
                return { type, id: payload.id };
            }
        }
        if (type === "music-segment" || type === "image-group") {
            if ("index" in payload && typeof payload.index === "number") {
                return { type, index: payload.index };
            }
            if ("id" in payload && typeof payload.id === "string") {
                const index = Number.parseInt(payload.id, 10);
                if (!Number.isNaN(index)) {
                    return { type, index };
                }
            }
        }
    }
    return null;
};

const parseDragPayload = (event: React.DragEvent) =>
    normalizeDragPayload(parseDragDataTransfer(event.dataTransfer, dragMimeType));

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
    const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
    const dropPreviewRef = useRef<DropPreview | null>(null);
    const dropPreviewRafRef = useRef<number | null>(null);
    const pendingDropPreviewRef = useRef<DropPreview | null>(null);
    const dropHintRef = useRef<string | null>(null);
    const [isDraggingImageVersion, setIsDraggingImageVersion] = useState(false);
    const isDraggingImageVersionRef = useRef(false);
    const [draggingSegmentIndex, setDraggingSegmentIndex] = useState<number | null>(null);
    const [draggingImageGroupIndex, setDraggingImageGroupIndex] = useState<number | null>(null);
    const previousVideoStatusRef = useRef<Video["status"] | null>(null);
    const musicTimelineRef = useRef<HTMLDivElement | null>(null);
    const imageTimelineRef = useRef<HTMLDivElement | null>(null);
    const segmentsListRef = useRef<HTMLDivElement | null>(null);
    const imageGroupsListRef = useRef<HTMLDivElement | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const loadEditorData = useCallback(async (silent = false) => {
        if (!silent) {
            setIsLoading(true);
        }
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

            if (!isMountedRef.current) {
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
            if (!silent && isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [projectId]);

    useEffect(() => {
        loadEditorData();
    }, [loadEditorData]);

    useEffect(() => {
        const handleRefresh = () => {
            loadEditorData(true);
        };
        window.addEventListener(EVENTS.REFRESH_PROJECT_MUSIC, handleRefresh);
        window.addEventListener(EVENTS.REFRESH_PROJECT_IMAGES, handleRefresh);
        window.addEventListener(EVENTS.MUSIC_LIST_UPDATED, handleRefresh);
        window.addEventListener(EVENTS.IMAGE_LIST_UPDATED, handleRefresh);
        return () => {
            window.removeEventListener(EVENTS.REFRESH_PROJECT_MUSIC, handleRefresh);
            window.removeEventListener(EVENTS.REFRESH_PROJECT_IMAGES, handleRefresh);
            window.removeEventListener(EVENTS.MUSIC_LIST_UPDATED, handleRefresh);
            window.removeEventListener(EVENTS.IMAGE_LIST_UPDATED, handleRefresh);
        };
    }, [loadEditorData]);

    useEffect(() => {
        if (!projectId || (!isRendering && video?.status !== "RENDERING")) {
            return;
        }
        const intervalId = window.setInterval(async () => {
            try {
                const response = await videoApi.get(projectId);
                if (isMountedRef.current) {
                    setVideo(response.video);
                }
            } catch (error) {
                console.error("Failed to refresh video status:", error);
            }
        }, 5000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [projectId, video?.status, isRendering]);

    useEffect(() => {
        if (!video) {
            return;
        }
        const previousStatus = previousVideoStatusRef.current;
        if (previousStatus === "RENDERING" && video.status === "READY") {
            toast("Video render completed", "success");
        }
        previousVideoStatusRef.current = video.status;
    }, [video?.status]);

    const totalDuration = useMemo(
        () => getTotalDurationSeconds(segments),
        [segments]
    );
    const displaySegments = useMemo(
        () =>
            segments.map((segment, index) => ({ segment, index })),
        [segments]
    );
    const displaySegmentItems = useMemo(
        () => displaySegments.map((item) => item.segment),
        [displaySegments]
    );
    const displayImageGroups = useMemo(
        () =>
            imageGroups.map((group, index) => ({ group, index })),
        [imageGroups]
    );
    const videoFileUrl = useMemo(() => {
        if (!video || video.status !== "READY") {
            return "";
        }
        return videoApi.getFileUrl(projectId, video.fileId);
    }, [projectId, video?.fileId, video?.status]);

    const resolveMusicPreview = (payload: DragPayload | null | undefined) => {
        if (!payload) {
            return { name: "", durationSeconds: 0 };
        }
        if (payload.type === "music-version") {
            const version = musicVersions.find((item) => item.id === payload.id);
            const name = version?.musicAlias?.trim()
                ? version.musicAlias
                : version?.musicId ?? payload.id;
            return { name, durationSeconds: version?.durationSeconds ?? 0 };
        }
        if (payload.type === "music-segment") {
            const segment = segments[payload.index];
            if (!segment) {
                return { name: "", durationSeconds: 0 };
            }
            const version = musicVersions.find((item) => item.id === segment.musicVersionId);
            const name = version?.musicAlias?.trim()
                ? version.musicAlias
                : version?.musicId ?? segment.musicId;
            return { name, durationSeconds: segment.durationSeconds ?? 0 };
        }
        return { name: "", durationSeconds: 0 };
    };

    const previewListData =
        dropPreview?.target === "segments-list"
            ? resolveMusicPreview(dropPreview.payload)
            : { name: "", durationSeconds: 0 };
    const isListInsertPreview =
        dropPreview?.target === "segments-list" && dropPreview.payload.type === "music-version";
    const isListMovePreview =
        dropPreview?.target === "segments-list" && dropPreview.payload.type === "music-segment";
    const previewImageGroup =
        dropPreview?.target === "image-group-list" && dropPreview.payload.type === "image-group"
            ? imageGroups[dropPreview.payload.index]
            : null;
    const previewImageSlot =
        dropPreview?.target === "image-group-slot" && dropPreview.payload.type === "image-version"
            ? imageVersions.find((version) => version.id === dropPreview.payload.id)
            : null;
    const previewImageGroupSlot =
        dropPreview?.target === "image-group-slot" && dropPreview.payload.type === "image-group"
            ? imageGroups[dropPreview.payload.index]
            : null;

    const isRangeAvailable = (start: number, end: number) =>
        !imageGroups.some(
            (group) =>
                !(end < group.segmentIndexStart || start > group.segmentIndexEnd)
        );

    const getPayloadFromEvent = (event: React.DragEvent) =>
        parseDragPayload(event) ?? normalizeDragPayload(getDragPayload());

    const clearDragState = () => {
        clearDragPayload();
        setDraggingSegmentIndex(null);
        setDraggingImageGroupIndex(null);
        setDropHintSafe(null);
        setDropPreview(null);
        dropPreviewRef.current = null;
        dropHintRef.current = null;
        pendingDropPreviewRef.current = null;
        if (dropPreviewRafRef.current !== null) {
            window.cancelAnimationFrame(dropPreviewRafRef.current);
            dropPreviewRafRef.current = null;
        }
        setIsDraggingImageVersionSafe(false);
    };

    const setDropHintSafe = (next: string | null) => {
        if (dropHintRef.current === next) {
            return;
        }
        dropHintRef.current = next;
        setDropHint(next);
    };

    const setIsDraggingImageVersionSafe = (next: boolean) => {
        if (isDraggingImageVersionRef.current === next) {
            return;
        }
        isDraggingImageVersionRef.current = next;
        setIsDraggingImageVersion(next);
    };

    const setDropPreviewSafe = (next: DropPreview | null) => {
        const prev = dropPreviewRef.current;
        if (!next) {
            if (prev) {
                dropPreviewRef.current = null;
                setDropPreview(null);
            }
            return;
        }
        if (
            prev &&
            prev.target === next.target &&
            prev.index === next.index &&
            prev.payload.type === next.payload.type &&
            ((prev.payload.type === "music-version" || prev.payload.type === "image-version")
                ? prev.payload.id === (next.payload as typeof prev.payload).id
                : prev.payload.index === (next.payload as typeof prev.payload).index)
        ) {
            return;
        }
        dropPreviewRef.current = next;
        setDropPreview(next);
    };

    const scheduleDropPreview = (next: DropPreview | null) => {
        pendingDropPreviewRef.current = next;
        if (dropPreviewRafRef.current !== null) {
            return;
        }
        dropPreviewRafRef.current = window.requestAnimationFrame(() => {
            dropPreviewRafRef.current = null;
            setDropPreviewSafe(pendingDropPreviewRef.current);
        });
    };

    useEffect(() => {
        const handleDragEnd = () => {
            clearDragState();
        };
        document.addEventListener("dragend", handleDragEnd, true);
        document.addEventListener("drop", handleDragEnd, true);
        window.addEventListener("blur", handleDragEnd);
        return () => {
            document.removeEventListener("dragend", handleDragEnd, true);
            document.removeEventListener("drop", handleDragEnd, true);
            window.removeEventListener("blur", handleDragEnd);
            if (dropPreviewRafRef.current !== null) {
                window.cancelAnimationFrame(dropPreviewRafRef.current);
                dropPreviewRafRef.current = null;
            }
        };
    }, []);

    const getInsertIndexByPosition = (
        event: React.DragEvent,
        container: HTMLDivElement | null,
        segmentItems: DraftSegment[]
    ) => {
        if (!container) {
            return segmentItems.length;
        }
        const rect = container.getBoundingClientRect();
        const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        if (totalDuration <= 0) {
            return segmentItems.length;
        }
        const target = (x / rect.width) * totalDuration;
        return getInsertIndexByTime(segmentItems, target);
    };

    const getListInsertIndexByPosition = (
        event: React.DragEvent,
        container: HTMLDivElement | null,
        selector = "[data-segment-row='true']"
    ) => {
        if (!container) {
            return displaySegments.length;
        }
        const rows = Array.from(
            container.querySelectorAll(selector)
        ) as HTMLElement[];
        if (rows.length === 0) {
            return 0;
        }
        for (let i = 0; i < rows.length; i += 1) {
            const rect = rows[i].getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (event.clientY < midpoint) {
                return i;
            }
        }
        return rows.length;
    };

    const getRowIndexByPosition = (
        event: React.DragEvent,
        container: HTMLDivElement | null,
        selector = "[data-segment-row='true']"
    ) => {
        if (!container) {
            return 0;
        }
        const rows = Array.from(
            container.querySelectorAll(selector)
        ) as HTMLElement[];
        if (rows.length === 0) {
            return 0;
        }
        for (let i = 0; i < rows.length; i += 1) {
            const rect = rows[i].getBoundingClientRect();
            if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
                return i;
            }
            if (event.clientY < rect.top) {
                return i;
            }
        }
        return Math.max(0, rows.length - 1);
    };

    const getSegmentIndexByPosition = (
        event: React.DragEvent,
        container: HTMLDivElement | null,
        segmentItems: DraftSegment[]
    ) => {
        if (!container || segmentItems.length === 0) {
            return 0;
        }
        const rect = container.getBoundingClientRect();
        const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
        if (totalDuration <= 0) {
            return 0;
        }
        const target = (x / rect.width) * totalDuration;
        return getSegmentIndexByTime(segmentItems, target);
    };

    const getImageGroupTargetStart = (centerIndex: number, length: number) => {
        if (segments.length === 0) {
            return 0;
        }
        const offset = Math.floor(length / 2);
        const maxStart = Math.max(0, segments.length - length);
        return Math.max(0, Math.min(maxStart, centerIndex - offset));
    };

    const getRangeDurationSeconds = (start: number, length: number) => {
        const end = Math.min(segments.length - 1, start + length - 1);
        let sum = 0;
        for (let i = start; i <= end; i += 1) {
            sum += segments[i]?.durationSeconds ?? 0;
        }
        return sum;
    };

    const handleSegmentDragStart = (event: React.DragEvent, index: number) => {
        event.dataTransfer.setData(
            dragMimeType,
            JSON.stringify({ type: "music-segment", index })
        );
        event.dataTransfer.setData("text/plain", `music-segment:${index}`);
        event.dataTransfer.effectAllowed = "move";
        setDragPayload({ type: "music-segment", index });
        setDraggingSegmentIndex(index);
    };

    const handleImageGroupDragStart = (event: React.DragEvent, index: number) => {
        event.dataTransfer.setData(
            dragMimeType,
            JSON.stringify({ type: "image-group", index })
        );
        event.dataTransfer.setData("text/plain", `image-group:${index}`);
        event.dataTransfer.effectAllowed = "move";
        setDragPayload({ type: "image-group", index });
        setDraggingImageGroupIndex(index);
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

    const moveSegmentByIndex = (
        fromIndex: number,
        toIndex: number,
        mode: "insert" | "replace" = "insert"
    ) => {
        setSegments((prev) =>
            mode === "replace"
                ? moveItemByIndexReplace(prev, fromIndex, toIndex)
                : moveItemByIndex(prev, fromIndex, toIndex)
        );
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

    const addImageGroupForSegment = (versionId: string, segmentIndex: number) => {
        const version = imageVersions.find((item) => item.id === versionId);
        if (!version) {
            toast("Image version not found", "error");
            return;
        }
        setImageGroups((prev) => {
            const result = mergeImageGroupsOnInsert(
                prev,
                segmentIndex,
                version.id,
                version.imageId,
                segments.length
            );
            if (result.error) {
                toast(result.error, "error");
                return prev;
            }
            return result.groups;
        });
    };

    const handleDropMusic = (
        event: React.DragEvent,
        insertIndex: number,
        mode: "insert" | "replace" = "insert"
    ) => {
        event.preventDefault();
        event.stopPropagation();
        setDropHintSafe(null);
        setDropPreviewSafe(null);
        const payload = getPayloadFromEvent(event);
        if (!payload) {
            return;
        }
        if (payload.type === "music-version") {
            addSegmentByVersion(payload.id, insertIndex);
        }
        if (payload.type === "music-segment") {
            let targetIndex = insertIndex;
            if (mode === "insert" && draggingSegmentIndex !== null && draggingSegmentIndex < insertIndex) {
                targetIndex += 1;
            }
            moveSegmentByIndex(payload.index, targetIndex, mode);
            clearDragState();
        }
    };

    const handleDropImage = (event: React.DragEvent, segmentIndex: number) => {
        event.preventDefault();
        event.stopPropagation();
        setDropHintSafe(null);
        setDropPreviewSafe(null);
        const payload = getPayloadFromEvent(event);
        if (!payload || payload.type !== "image-version") {
            return;
        }
        addImageGroupForSegment(payload.id, segmentIndex);
    };

    const handleDropOnSegmentRow = (event: React.DragEvent, index: number) => {
        event.preventDefault();
        event.stopPropagation();
        setDropHintSafe(null);
        setDropPreviewSafe(null);
        const payload = getPayloadFromEvent(event);
        if (!payload) {
            return;
        }
        if (payload.type === "music-version" || payload.type === "music-segment") {
            const insertIndex =
                payload.type === "music-segment"
                    ? index
                    : getListInsertIndexByPosition(event, segmentsListRef.current);
            if (payload.type === "music-version") {
                addSegmentByVersion(payload.id, insertIndex);
                return;
            }
            moveSegmentByIndex(payload.index, insertIndex, "replace");
            clearDragState();
            return;
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

    const moveImageGroupByIndex = (fromIndex: number, toIndex: number) => {
        setImageGroups((prev) => moveItemByIndex(prev, fromIndex, toIndex));
    };

    const moveImageGroupBySlot = (groupIndex: number, targetStart: number) => {
        setImageGroups((prev) => moveImageGroupsBySlot(prev, groupIndex, targetStart, segments.length));
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
            toast("Video render requested", "success");
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

        const previewMusicPayload =
            dropPreview?.target === "music-timeline" ? dropPreview.payload : null;
        const previewMusicData = resolveMusicPreview(previewMusicPayload);
        const isReorderPreview =
            dropPreview?.target === "music-timeline" && previewMusicPayload?.type === "music-segment";
        const isInsertPreview =
            dropPreview?.target === "music-timeline" && previewMusicPayload?.type === "music-version";
        const insertPreviewLeft =
            dropPreview?.target === "music-timeline"
                ? getInsertOffsetPercent(segments, totalDuration, dropPreview.index)
                : null;
        const replacePreviewDuration = isReorderPreview
            ? segments[dropPreview.index]?.durationSeconds ?? 0
            : 0;
        const replacePreviewLeft = isReorderPreview
            ? getInsertOffsetPercent(segments, totalDuration, dropPreview.index)
            : null;
        const replacePreviewWidth =
            isReorderPreview && totalDuration > 0
                ? Math.max(4, (replacePreviewDuration / totalDuration) * 100)
                : 0;

        const isImageReorderPreview =
            dropPreview?.target === "image-timeline" && dropPreview.payload.type === "image-group";
        const imagePreviewLength = isImageReorderPreview
            ? (imageGroups[dropPreview.payload.index]?.segmentIndexEnd ?? 0) -
              (imageGroups[dropPreview.payload.index]?.segmentIndexStart ?? 0) +
              1
            : 1;
        const imagePreviewLeft =
            dropPreview?.target === "image-timeline"
                ? getInsertOffsetPercent(segments, totalDuration, dropPreview.index)
                : null;
        const imagePreviewDuration =
            dropPreview?.target === "image-timeline"
                ? getRangeDurationSeconds(dropPreview.index, imagePreviewLength)
                : 0;
        const imagePreviewWidth =
            dropPreview?.target === "image-timeline" && totalDuration > 0
                ? Math.max(4, (imagePreviewDuration / totalDuration) * 100)
                : 0;

        return (
            <div className="space-y-4">
                <div
                    ref={musicTimelineRef}
                    className={`relative flex h-10 w-full overflow-hidden rounded-md border border-border ${
                        isReorderPreview ? "ring-2 ring-primary/40" : ""
                    }`}
                    onDragOver={(event) => {
                        event.preventDefault();
                        const payload = getPayloadFromEvent(event);
                        if (!payload || (payload.type !== "music-version" && payload.type !== "music-segment")) {
                            setDropHintSafe(null);
                            scheduleDropPreview(null);
                            return;
                        }
                        setDropHintSafe("music-timeline");
                        const insertIndex =
                            payload.type === "music-segment"
                                ? getSegmentIndexByPosition(event, musicTimelineRef.current, segments)
                                : getInsertIndexByPosition(event, musicTimelineRef.current, segments);
                        scheduleDropPreview({
                            target: "music-timeline",
                            index: insertIndex,
                            payload,
                        });
                    }}
                    onDragLeave={() => {
                        setDropHintSafe(null);
                        scheduleDropPreview(null);
                    }}
                    onDrop={(event) => {
                        const payload = getPayloadFromEvent(event);
                        if (!payload) {
                            return;
                        }
                        if (payload.type === "music-segment") {
                            const targetIndex = getSegmentIndexByPosition(event, musicTimelineRef.current, segments);
                            handleDropMusic(event, targetIndex, "replace");
                            return;
                        }
                        const insertIndex = getInsertIndexByPosition(event, musicTimelineRef.current, segments);
                        handleDropMusic(event, insertIndex, "insert");
                    }}
                >
                    {isReorderPreview && (
                        <div
                            className="pointer-events-none absolute top-0 h-full rounded-md border border-primary/40 bg-primary/20"
                            style={{
                                left: `${replacePreviewLeft ?? 0}%`,
                                width: `${replacePreviewWidth}%`,
                            }}
                        />
                    )}
                    {isInsertPreview && (
                        <>
                            <div
                                className="pointer-events-none absolute top-0 z-20 h-full"
                                style={{
                                    left: `calc(${insertPreviewLeft ?? 0}% - 12px)`,
                                    width: "24px",
                                    backgroundColor: "rgba(59, 130, 246, 0.25)",
                                    boxShadow: "0 0 14px rgba(59, 130, 246, 0.45)",
                                    borderLeft: "1px solid rgba(59, 130, 246, 0.35)",
                                    borderRight: "1px solid rgba(59, 130, 246, 0.35)",
                                }}
                            />
                        </>
                    )}
                    {displaySegments.map(({ segment, index }) => {
                        const width = Math.max(4, (segment.durationSeconds / totalDuration) * 100);
                        const label = musicVersions.find((item) => item.id === segment.musicVersionId);
                        const title = label?.musicAlias?.trim()
                            ? label.musicAlias
                            : label?.musicId ?? segment.musicId;
                        const isDragging = draggingSegmentIndex === index;
                        return (
                            <div
                                key={`${segment.musicVersionId}-${index}`}
                                className={`flex h-full items-center justify-center border-r border-border bg-muted text-xs text-muted-foreground ${
                                    isDragging ? "opacity-40" : ""
                                }`}
                                style={{ width: `${width}%` }}
                                title={title}
                                draggable
                                onDragStart={(event) => handleSegmentDragStart(event, index)}
                                onDragEnd={clearDragState}
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
                        if (segments.length === 0) {
                            setDropHintSafe(null);
                            scheduleDropPreview(null);
                            return;
                        }
                        const payload = getPayloadFromEvent(event);
                        if (!payload || (payload.type !== "image-version" && payload.type !== "image-group")) {
                            setDropHintSafe(null);
                            scheduleDropPreview(null);
                            return;
                        }
                        setDropHintSafe("image-timeline");
                        if (payload.type === "image-group") {
                            const group = imageGroups[payload.index];
                            if (!group) {
                                setDropHintSafe(null);
                                scheduleDropPreview(null);
                                return;
                            }
                            const centerIndex = getSegmentIndexByPosition(
                                event,
                                imageTimelineRef.current,
                                segments
                            );
                            const length = group.segmentIndexEnd - group.segmentIndexStart + 1;
                            const targetStart = getImageGroupTargetStart(centerIndex, length);
                            scheduleDropPreview({
                                target: "image-timeline",
                                index: targetStart,
                                payload,
                            });
                            return;
                        }
                        const clampedIndex = getSegmentIndexByPosition(
                            event,
                            imageTimelineRef.current,
                            segments
                        );
                        scheduleDropPreview({
                            target: "image-timeline",
                            index: clampedIndex,
                            payload,
                        });
                    }}
                    onDragLeave={() => {
                        setDropHintSafe(null);
                        scheduleDropPreview(null);
                    }}
                    onDrop={(event) => {
                        if (segments.length === 0) {
                            toast("Add music segments first", "error");
                            return;
                        }
                        const payload = getPayloadFromEvent(event);
                        if (payload?.type === "image-group") {
                            const group = imageGroups[payload.index];
                            if (!group) {
                                return;
                            }
                            const centerIndex = getSegmentIndexByPosition(
                                event,
                                imageTimelineRef.current,
                                segments
                            );
                            const length = group.segmentIndexEnd - group.segmentIndexStart + 1;
                            const targetStart = getImageGroupTargetStart(centerIndex, length);
                            moveImageGroupBySlot(payload.index, targetStart);
                            clearDragState();
                            return;
                        }
                        const index = getSegmentIndexByPosition(event, imageTimelineRef.current, segments);
                        handleDropImage(event, index);
                    }}
                >
                    {dropPreview?.target === "image-timeline" && segments.length > 0 && (
                        <div
                            className="pointer-events-none absolute top-0 h-full rounded-md border border-amber-400/60 bg-amber-300/30"
                            style={{
                                left: `${imagePreviewLeft ?? 0}%`,
                                width: `${imagePreviewWidth}%`,
                            }}
                        />
                    )}
                    {imageGroups.map((group, index) => {
                        const duration = getImageGroupDurationSeconds(group, segments);
                        const start = getImageGroupStartSeconds(group, segments);
                        const width = totalDuration ? Math.max(4, (duration / totalDuration) * 100) : 0;
                        const offset = totalDuration ? (start / totalDuration) * 100 : 0;
                        return (
                            <div
                                key={`${group.imageVersionId}-${index}`}
                                className="absolute top-0 h-10 rounded-md bg-amber-200/35 text-xs text-amber-900"
                                style={{ width: `${width}%`, left: `${offset}%` }}
                                title={`Image ${group.imageId}`}
                                draggable
                                onDragStart={(event) => handleImageGroupDragStart(event, index)}
                                onDragEnd={clearDragState}
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
                            {video?.status === "READY" && videoFileUrl ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                                        <span>Rendered Video</span>
                                        <Button variant="outline" size="sm" asChild>
                                            <a href={videoFileUrl} target="_blank" rel="noreferrer">
                                                Open
                                            </a>
                                        </Button>
                                    </div>
                                    <video
                                        className="w-full rounded-md border border-border bg-black"
                                        controls
                                        src={videoFileUrl}
                                    />
                                </div>
                            ) : null}
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
                                            const payload = getPayloadFromEvent(event);
                                            if (!payload || payload.type !== "music-version") {
                                                setDropHintSafe(null);
                                                scheduleDropPreview(null);
                                                return;
                                            }
                                            setDropHintSafe("segments-list");
                                            scheduleDropPreview({
                                                target: "segments-list",
                                                index: segments.length,
                                                payload,
                                            });
                                        }}
                                        onDragLeave={() => {
                                            setDropHintSafe(null);
                                            scheduleDropPreview(null);
                                        }}
                                        onDrop={(event) => handleDropMusic(event, displaySegments.length, "insert")}
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
                                            const payload = getPayloadFromEvent(event);
                                            if (!payload || (payload.type !== "music-version" && payload.type !== "music-segment")) {
                                                setDropHintSafe(null);
                                                scheduleDropPreview(null);
                                                return;
                                            }
                                            setDropHintSafe("segments-list");
                                            scheduleDropPreview({
                                                target: "segments-list",
                                                index: 0,
                                                payload,
                                            });
                                        }}
                                        onDragLeave={() => {
                                            setDropHintSafe(null);
                                            scheduleDropPreview(null);
                                        }}
                                        onDrop={(event) => {
                                            const payload = getPayloadFromEvent(event);
                                            if (!payload) {
                                                return;
                                            }
                                            if (payload.type === "music-version" || payload.type === "music-segment") {
                                                handleDropMusic(event, 0);
                                                return;
                                            }
                                            if (payload.type === "image-version") {
                                                toast("Add a music segment first", "error");
                                            }
                                        }}
                                    >
                                        No segments yet.
                                    </div>
                                ) : (
                                    <div
                                        ref={segmentsListRef}
                                        className="space-y-2"
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            const payload = getPayloadFromEvent(event);
                                            if (!payload || (payload.type !== "music-version" && payload.type !== "music-segment")) {
                                                setDropHintSafe(null);
                                                scheduleDropPreview(null);
                                                return;
                                            }
                                            setDropHintSafe("segments-list");
                                            const insertIndex =
                                                payload.type === "music-segment"
                                                    ? getRowIndexByPosition(event, segmentsListRef.current)
                                                    : getListInsertIndexByPosition(event, segmentsListRef.current);
                                            scheduleDropPreview({
                                                target: "segments-list",
                                                index: insertIndex,
                                                payload,
                                            });
                                        }}
                                        onDragLeave={() => {
                                            setDropHintSafe(null);
                                            scheduleDropPreview(null);
                                        }}
                                        onDrop={(event) => {
                                            const payload = getPayloadFromEvent(event);
                                            if (!payload) {
                                                return;
                                            }
                                            const insertIndex =
                                                payload.type === "music-segment"
                                                    ? getRowIndexByPosition(event, segmentsListRef.current)
                                                    : getListInsertIndexByPosition(event, segmentsListRef.current);
                                            if (payload.type === "music-version") {
                                                handleDropMusic(event, insertIndex, "insert");
                                                return;
                                            }
                                            if (payload.type === "music-segment") {
                                                handleDropMusic(event, insertIndex, "replace");
                                                return;
                                            }
                                            if (payload.type === "image-version") {
                                                const targetIndex = Math.min(insertIndex, segments.length - 1);
                                                handleDropImage(event, targetIndex);
                                            }
                                        }}
                                    >
                                        {displaySegments.map(({ segment, index }) => (
                                            <Fragment key={`${segment.musicVersionId}-${index}`}>
                                                {dropPreview?.target === "segments-list" &&
                                                    dropPreview.index === index &&
                                                    isListInsertPreview &&
                                                    (previewListData.name || previewListData.durationSeconds) && (
                                                        <div className="flex items-center justify-between rounded-md border border-dashed border-primary/40 bg-primary/10 px-3 py-2 text-sm text-muted-foreground opacity-70">
                                                            <div className="space-y-1">
                                                                <div className="font-medium">New segment</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {previewListData.name
                                                                        ? `${previewListData.name} · `
                                                                        : ""}
                                                                    {formatDuration(previewListData.durationSeconds)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                <div
                                                    data-segment-row="true"
                                                    className={`flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm ${
                                                        draggingSegmentIndex === index ? "opacity-40" : ""
                                                    } ${
                                                        isListMovePreview && dropPreview?.index === index
                                                            ? "ring-2 ring-primary/40"
                                                            : ""
                                                    }`}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        const payload = getPayloadFromEvent(event);
                                                        if (!payload || (payload.type !== "music-version" && payload.type !== "music-segment")) {
                                                            setDropHintSafe(null);
                                                            scheduleDropPreview(null);
                                                            return;
                                                        }
                                                        setDropHintSafe("segment-row");
                                                        scheduleDropPreview({
                                                            target: "segments-list",
                                                            index,
                                                            payload,
                                                        });
                                                    }}
                                                    onDragLeave={() => {
                                                        setDropHintSafe(null);
                                                        scheduleDropPreview(null);
                                                    }}
                                                    onDrop={(event) => handleDropOnSegmentRow(event, index)}
                                                    draggable
                                                    onDragStart={(event) => handleSegmentDragStart(event, index)}
                                                    onDragEnd={clearDragState}
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
                                            </Fragment>
                                        ))}
                                        {dropPreview?.target === "segments-list" &&
                                            dropPreview.index === displaySegments.length &&
                                            isListInsertPreview &&
                                            (previewListData.name || previewListData.durationSeconds) && (
                                                <div className="flex items-center justify-between rounded-md border border-dashed border-primary/40 bg-primary/10 px-3 py-2 text-sm text-muted-foreground opacity-70">
                                                    <div className="space-y-1">
                                                        <div className="font-medium">New segment</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {previewListData.name ? `${previewListData.name} · ` : ""}
                                                            {formatDuration(previewListData.durationSeconds)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
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

                                {segments.length === 0 ? (
                                    <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                                        Add music segments first.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {segments.map((_, index) => {
                                            const group = imageGroups.find(
                                                (item) =>
                                                    index >= item.segmentIndexStart &&
                                                    index <= item.segmentIndexEnd
                                            );
                                            const isStart = group?.segmentIndexStart === index;
                                            const isOccupied = Boolean(group);
                                            const isBlocked = isOccupied && !isStart;
                                            const isPreview =
                                                dropPreview?.target === "image-group-slot" &&
                                                dropPreview.index === index &&
                                                previewImageSlot;
                                            const isGroupPreview = Boolean(
                                                previewImageGroupSlot &&
                                                    dropPreview?.target === "image-group-slot" &&
                                                    index >= dropPreview.index &&
                                                    index <=
                                                        dropPreview.index +
                                                            (previewImageGroupSlot.segmentIndexEnd -
                                                                previewImageGroupSlot.segmentIndexStart)
                                            );
                                            const isEmpty = !isOccupied && !isPreview;
                                            const previewLabel = previewImageSlot
                                                ? `Image ${previewImageSlot.imageId.slice(0, 6)}`
                                                : "";
                                            const groupIndex = group ? imageGroups.indexOf(group) : -1;
                                            return (
                                                <div
                                                    key={`image-slot-${index}`}
                                                    data-image-group-row="true"
                                                    className={`flex h-[58px] items-center justify-between rounded-md border border-border px-3 py-2 text-sm ${
                                                        isPreview || isGroupPreview ? "border-dashed border-primary/40 bg-primary/10" : ""
                                                    } ${isBlocked ? "bg-muted" : ""} ${
                                                        isEmpty
                                                            ? isDraggingImageVersion
                                                                ? "border-dashed border-border/40 bg-transparent"
                                                                : "border-transparent bg-transparent"
                                                            : ""
                                                    }`}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        const payload = getPayloadFromEvent(event);
                                                        if (!payload) {
                                                            setDropHintSafe(null);
                                                            scheduleDropPreview(null);
                                                            return;
                                                        }
                                                        if (payload.type === "image-group") {
                                                            const groupItem = imageGroups[payload.index];
                                                            if (!groupItem) {
                                                                setDropHintSafe(null);
                                                                scheduleDropPreview(null);
                                                                return;
                                                            }
                                                            const length =
                                                                groupItem.segmentIndexEnd - groupItem.segmentIndexStart + 1;
                                                            const targetStart = getImageGroupTargetStart(index, length);
                                                            setDropHintSafe("image-group-slot");
                                                            scheduleDropPreview({
                                                                target: "image-group-slot",
                                                                index: targetStart,
                                                                payload,
                                                            });
                                                            return;
                                                        }
                                                        if (payload.type !== "image-version" || isOccupied) {
                                                            setDropHintSafe(null);
                                                            scheduleDropPreview(null);
                                                            setIsDraggingImageVersionSafe(false);
                                                            return;
                                                        }
                                                        setIsDraggingImageVersionSafe(true);
                                                        setDropHintSafe("image-group-slot");
                                                        scheduleDropPreview({
                                                            target: "image-group-slot",
                                                            index,
                                                            payload,
                                                        });
                                                    }}
                                                    onDragLeave={() => {
                                                        setDropHintSafe(null);
                                                        scheduleDropPreview(null);
                                                        setIsDraggingImageVersionSafe(false);
                                                    }}
                                                    onDrop={(event) => {
                                                        event.preventDefault();
                                                        const payload = getPayloadFromEvent(event);
                                                        if (!payload) {
                                                            return;
                                                        }
                                                        if (payload.type === "image-group") {
                                                            const groupItem = imageGroups[payload.index];
                                                            if (!groupItem) {
                                                                return;
                                                            }
                                                            const length =
                                                                groupItem.segmentIndexEnd - groupItem.segmentIndexStart + 1;
                                                            const targetStart = getImageGroupTargetStart(index, length);
                                                            moveImageGroupBySlot(payload.index, targetStart);
                                                            clearDragState();
                                                            return;
                                                        }
                                                        if (payload.type !== "image-version" || isOccupied) {
                                                            return;
                                                        }
                                                        addImageGroupForSegment(payload.id, index);
                                                        setDropHintSafe(null);
                                                        scheduleDropPreview(null);
                                                    }}
                                                    draggable={isStart}
                                                    onDragStart={(event) => {
                                                        if (!isStart || groupIndex < 0) {
                                                            return;
                                                        }
                                                        handleImageGroupDragStart(event, groupIndex);
                                                    }}
                                                    onDragEnd={clearDragState}
                                                >
                                                    {isPreview ? (
                                                        <div className="space-y-1 text-muted-foreground">
                                                            <div className="font-medium">New image</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {previewLabel || "Image"}
                                                            </div>
                                                        </div>
                                                    ) : isStart ? (
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                Image {group?.imageId.slice(0, 6)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Segments {group?.segmentIndexStart + 1} - {group?.segmentIndexEnd + 1}
                                                            </div>
                                                        </div>
                                                    ) : isBlocked ? (
                                                        <div className="space-y-1 opacity-0">
                                                            <div className="font-medium">Segment {index + 1}</div>
                                                            <div className="text-xs text-muted-foreground">Image</div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1 opacity-0">
                                                            <div className="font-medium">Segment {index + 1}</div>
                                                            <div className="text-xs text-muted-foreground opacity-0">Image</div>
                                                        </div>
                                                    )}
                                                    {isStart && groupIndex >= 0 ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeImageGroup(groupIndex)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
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
