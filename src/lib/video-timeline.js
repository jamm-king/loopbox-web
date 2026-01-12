const getTotalDurationSeconds = (segments) =>
    segments.reduce((sum, segment) => sum + (segment.durationSeconds || 0), 0);

const buildSegmentOffsets = (segments) => {
    let cursor = 0;
    return segments.map((segment) => {
        const start = cursor;
        const duration = segment.durationSeconds || 0;
        const end = start + duration;
        cursor = end;
        return { start, end };
    });
};

const getImageGroupDurationSeconds = (imageGroup, segments) => {
    if (!imageGroup || segments.length === 0) {
        return 0;
    }
    const start = Math.max(0, imageGroup.segmentIndexStart);
    const end = Math.min(segments.length - 1, imageGroup.segmentIndexEnd);
    let sum = 0;
    for (let i = start; i <= end; i += 1) {
        sum += segments[i]?.durationSeconds || 0;
    }
    return sum;
};

const getImageGroupStartSeconds = (imageGroup, segments) => {
    if (!imageGroup || segments.length === 0) {
        return 0;
    }
    const offsets = buildSegmentOffsets(segments);
    const startIndex = Math.min(
        Math.max(0, imageGroup.segmentIndexStart),
        offsets.length - 1
    );
    return offsets[startIndex]?.start ?? 0;
};

module.exports = {
    getTotalDurationSeconds,
    buildSegmentOffsets,
    getImageGroupDurationSeconds,
    getImageGroupStartSeconds,
};
