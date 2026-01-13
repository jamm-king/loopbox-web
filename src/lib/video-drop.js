const getInsertOffsetPercent = (segments, totalDuration, insertIndex) => {
    if (totalDuration <= 0) {
        return 0;
    }
    let offset = 0;
    for (let i = 0; i < insertIndex; i += 1) {
        offset += segments[i]?.durationSeconds ?? 0;
    }
    return (offset / totalDuration) * 100;
};

const getInsertIndexByTime = (segments, targetSeconds) => {
    if (!Array.isArray(segments) || segments.length === 0) {
        return 0;
    }
    let cursor = 0;
    for (let i = 0; i < segments.length; i += 1) {
        const duration = segments[i]?.durationSeconds ?? 0;
        const midpoint = cursor + duration / 2;
        if (targetSeconds < midpoint) {
            return i;
        }
        cursor += duration;
    }
    return segments.length;
};

const getSegmentIndexByTime = (segments, targetSeconds) => {
    if (!Array.isArray(segments) || segments.length === 0) {
        return 0;
    }
    let cursor = 0;
    for (let i = 0; i < segments.length; i += 1) {
        const duration = segments[i]?.durationSeconds ?? 0;
        const end = cursor + duration;
        if (targetSeconds < end) {
            return i;
        }
        cursor = end;
    }
    return Math.max(0, segments.length - 1);
};

const parseDragDataTransfer = (dataTransfer, mimeType = "application/x-loopbox") => {
    if (!dataTransfer || typeof dataTransfer.getData !== "function") {
        return null;
    }
    const payload = dataTransfer.getData(mimeType);
    if (payload) {
        try {
            return JSON.parse(payload);
        } catch {
            return null;
        }
    }
    const fallback = dataTransfer.getData("text/plain");
    if (!fallback) {
        return null;
    }
    const [type, id] = fallback.split(":");
    if (!type || !id) {
        return null;
    }
    return { type, id };
};

const mergeImageGroupsOnInsert = (groups, segmentIndex, imageVersionId, imageId, segmentsLength) => {
    if (segmentIndex < 0 || segmentIndex >= segmentsLength) {
        return { groups, error: "Segment range is invalid" };
    }

    const overlapping = groups.find(
        (group) =>
            segmentIndex >= group.segmentIndexStart &&
            segmentIndex <= group.segmentIndexEnd
    );
    if (overlapping) {
        if (overlapping.imageVersionId === imageVersionId) {
            return { groups, merged: true };
        }
        return { groups, error: "Image group overlaps an existing range" };
    }

    const leftIndex = groups.findIndex(
        (group) =>
            group.imageVersionId === imageVersionId &&
            group.segmentIndexEnd === segmentIndex - 1
    );
    const rightIndex = groups.findIndex(
        (group) =>
            group.imageVersionId === imageVersionId &&
            group.segmentIndexStart === segmentIndex + 1
    );

    if (leftIndex >= 0 && rightIndex >= 0 && leftIndex !== rightIndex) {
        const left = groups[leftIndex];
        const right = groups[rightIndex];
        const next = groups.filter((_, idx) => idx !== leftIndex && idx !== rightIndex);
        next.push({
            imageVersionId,
            imageId,
            segmentIndexStart: left.segmentIndexStart,
            segmentIndexEnd: right.segmentIndexEnd,
        });
        return { groups: next, merged: true };
    }

    if (leftIndex >= 0) {
        const next = groups.map((group, idx) =>
            idx === leftIndex
                ? { ...group, segmentIndexEnd: segmentIndex }
                : group
        );
        return { groups: next, merged: true };
    }

    if (rightIndex >= 0) {
        const next = groups.map((group, idx) =>
            idx === rightIndex
                ? { ...group, segmentIndexStart: segmentIndex }
                : group
        );
        return { groups: next, merged: true };
    }

    return {
        groups: [
            ...groups,
            {
                imageVersionId,
                imageId,
                segmentIndexStart: segmentIndex,
                segmentIndexEnd: segmentIndex,
            },
        ],
        merged: false,
    };
};

const moveItemByIndex = (items, fromIndex, toIndex) => {
    if (!Array.isArray(items)) {
        return items;
    }
    if (fromIndex === toIndex) {
        return items;
    }
    if (fromIndex < 0 || fromIndex >= items.length) {
        return items;
    }
    let targetIndex = Math.max(0, Math.min(items.length, toIndex));
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    if (fromIndex < targetIndex) {
        targetIndex -= 1;
    }
    next.splice(targetIndex, 0, moved);
    return next;
};

const moveItemByIndexReplace = (items, fromIndex, toIndex) => {
    if (!Array.isArray(items)) {
        return items;
    }
    if (fromIndex === toIndex) {
        return items;
    }
    if (fromIndex < 0 || fromIndex >= items.length) {
        return items;
    }
    const targetIndex = Math.max(0, Math.min(items.length - 1, toIndex));
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
};

const moveImageGroupsBySlot = (groups, groupIndex, targetStart, segmentsLength) => {
    if (!Array.isArray(groups) || segmentsLength <= 0) {
        return groups;
    }
    if (groupIndex < 0 || groupIndex >= groups.length) {
        return groups;
    }
    const active = groups[groupIndex];
    const length = Math.max(1, active.segmentIndexEnd - active.segmentIndexStart + 1);
    const maxStart = Math.max(0, segmentsLength - length);
    const nextStart = Math.max(0, Math.min(maxStart, targetStart));
    const slots = Array.from({ length: segmentsLength }, () => null);
    groups.forEach((group, idx) => {
        for (let i = group.segmentIndexStart; i <= group.segmentIndexEnd; i += 1) {
            if (i >= 0 && i < segmentsLength) {
                slots[i] = idx;
            }
        }
    });
    const block = slots.slice(active.segmentIndexStart, active.segmentIndexStart + length);
    slots.splice(active.segmentIndexStart, length);
    slots.splice(nextStart, 0, ...block);
    const rebuilt = [];
    let currentIdx = null;
    let startIndex = null;
    for (let i = 0; i <= slots.length; i += 1) {
        const slot = i < slots.length ? slots[i] : null;
        if (slot !== currentIdx) {
            if (currentIdx !== null && startIndex !== null) {
                const source = groups[currentIdx];
                rebuilt.push({
                    imageVersionId: source.imageVersionId,
                    imageId: source.imageId,
                    segmentIndexStart: startIndex,
                    segmentIndexEnd: i - 1,
                });
            }
            currentIdx = slot;
            startIndex = slot !== null ? i : null;
        }
    }
    return rebuilt.reduce((acc, group) => {
        const last = acc[acc.length - 1];
        if (last && last.imageVersionId === group.imageVersionId) {
            last.segmentIndexEnd = group.segmentIndexEnd;
            return acc;
        }
        acc.push({ ...group });
        return acc;
    }, []);
};

module.exports = {
    getInsertOffsetPercent,
    getInsertIndexByTime,
    getSegmentIndexByTime,
    parseDragDataTransfer,
    mergeImageGroupsOnInsert,
    moveItemByIndex,
    moveItemByIndexReplace,
    moveImageGroupsBySlot,
};
