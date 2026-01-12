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

module.exports = {
    getInsertOffsetPercent,
    getInsertIndexByTime,
    parseDragDataTransfer,
    mergeImageGroupsOnInsert,
};
