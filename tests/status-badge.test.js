const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getStatusBadgeVariant } = require("../src/lib/status-badge");
const { getMusicDisplayName } = require("../src/lib/music-display");
const { buildCreateMusicRequest } = require("../src/lib/music-create");
const { buildProjectUpdateRequest } = require("../src/lib/project-update");
const {
    getTotalDurationSeconds,
    buildSegmentOffsets,
    getImageGroupDurationSeconds,
    getImageGroupStartSeconds,
} = require("../src/lib/video-timeline");
const {
    getInsertIndexByTime,
    getInsertOffsetPercent,
    getSegmentIndexByTime,
    mergeImageGroupsOnInsert,
    moveItemByIndex,
    moveItemByIndexReplace,
    moveImageGroupsBySlot,
    parseDragDataTransfer,
} = require("../src/lib/video-drop");
const {
    setDragPayload,
    getDragPayload,
    clearDragPayload,
} = require("../src/lib/drag-payload");

test("getStatusBadgeVariant returns default for IDLE", () => {
    assert.equal(getStatusBadgeVariant("IDLE"), "default");
});

test("getStatusBadgeVariant returns destructive for FAILED", () => {
    assert.equal(getStatusBadgeVariant("FAILED"), "destructive");
});

test("getStatusBadgeVariant returns secondary for other statuses", () => {
    assert.equal(getStatusBadgeVariant("COMPLETED"), "secondary");
    assert.equal(getStatusBadgeVariant("GENERATING"), "secondary");
});

test("getMusicDisplayName returns alias when present", () => {
    assert.equal(
        getMusicDisplayName({ id: "music-12345678", alias: "My Song" }),
        "My Song"
    );
});

test("getMusicDisplayName falls back to prefixed short id", () => {
    assert.equal(
        getMusicDisplayName({ id: "music-12345678", alias: "  " }, { prefix: "Music" }),
        "Music music-12"
    );
});

test("getMusicDisplayName falls back to short id without prefix", () => {
    assert.equal(
        getMusicDisplayName({ id: "music-12345678" }),
        "music-12"
    );
});

test("buildCreateMusicRequest returns undefined when alias is empty", () => {
    assert.equal(buildCreateMusicRequest("  "), undefined);
});

test("buildCreateMusicRequest returns trimmed alias payload", () => {
    assert.deepEqual(
        buildCreateMusicRequest("  Night Drive "),
        { alias: "Night Drive" }
    );
});

test("buildProjectUpdateRequest returns null when title is empty", () => {
    assert.equal(buildProjectUpdateRequest("   "), null);
});

test("buildProjectUpdateRequest returns trimmed title payload", () => {
    assert.deepEqual(
        buildProjectUpdateRequest("  New Project "),
        { title: "New Project" }
    );
});

test("getTotalDurationSeconds sums segment durations", () => {
    const total = getTotalDurationSeconds([
        { durationSeconds: 12 },
        { durationSeconds: 30 },
    ]);
    assert.equal(total, 42);
});

test("buildSegmentOffsets returns cumulative ranges", () => {
    const offsets = buildSegmentOffsets([
        { durationSeconds: 10 },
        { durationSeconds: 5 },
    ]);
    assert.deepEqual(offsets, [
        { start: 0, end: 10 },
        { start: 10, end: 15 },
    ]);
});

test("getImageGroupDurationSeconds sums range durations", () => {
    const duration = getImageGroupDurationSeconds(
        { segmentIndexStart: 1, segmentIndexEnd: 2 },
        [{ durationSeconds: 10 }, { durationSeconds: 20 }, { durationSeconds: 5 }]
    );
    assert.equal(duration, 25);
});

test("getImageGroupStartSeconds returns range start", () => {
    const start = getImageGroupStartSeconds(
        { segmentIndexStart: 1, segmentIndexEnd: 2 },
        [{ durationSeconds: 10 }, { durationSeconds: 20 }, { durationSeconds: 5 }]
    );
    assert.equal(start, 10);
});

test("getInsertOffsetPercent returns start percent for insert index", () => {
    const percent = getInsertOffsetPercent(
        [{ durationSeconds: 10 }, { durationSeconds: 30 }, { durationSeconds: 20 }],
        60,
        2
    );
    assert.equal(percent, (40 / 60) * 100);
});

test("getInsertOffsetPercent returns 0 when total duration is zero", () => {
    const percent = getInsertOffsetPercent([{ durationSeconds: 10 }], 0, 1);
    assert.equal(percent, 0);
});

test("getInsertIndexByTime returns index based on midpoint", () => {
    const segments = [{ durationSeconds: 10 }, { durationSeconds: 10 }];
    assert.equal(getInsertIndexByTime(segments, 4), 0);
    assert.equal(getInsertIndexByTime(segments, 6), 1);
});

test("getInsertIndexByTime returns end index for tail position", () => {
    const segments = [{ durationSeconds: 8 }, { durationSeconds: 12 }];
    assert.equal(getInsertIndexByTime(segments, 25), 2);
});

test("getSegmentIndexByTime returns index of segment range", () => {
    const segments = [{ durationSeconds: 10 }, { durationSeconds: 10 }, { durationSeconds: 5 }];
    assert.equal(getSegmentIndexByTime(segments, 0), 0);
    assert.equal(getSegmentIndexByTime(segments, 9.9), 0);
    assert.equal(getSegmentIndexByTime(segments, 10), 1);
    assert.equal(getSegmentIndexByTime(segments, 19.9), 1);
    assert.equal(getSegmentIndexByTime(segments, 25), 2);
});

test("mergeImageGroupsOnInsert extends left neighbor with same version", () => {
    const result = mergeImageGroupsOnInsert(
        [
            {
                imageVersionId: "img-v1",
                imageId: "img-1",
                segmentIndexStart: 0,
                segmentIndexEnd: 1,
            },
        ],
        2,
        "img-v1",
        "img-1",
        5
    );
    assert.equal(result.error, undefined);
    assert.equal(result.groups[0].segmentIndexEnd, 2);
});

test("mergeImageGroupsOnInsert extends right neighbor with same version", () => {
    const result = mergeImageGroupsOnInsert(
        [
            {
                imageVersionId: "img-v1",
                imageId: "img-1",
                segmentIndexStart: 2,
                segmentIndexEnd: 3,
            },
        ],
        1,
        "img-v1",
        "img-1",
        5
    );
    assert.equal(result.error, undefined);
    assert.equal(result.groups[0].segmentIndexStart, 1);
});

test("mergeImageGroupsOnInsert merges both sides with same version", () => {
    const result = mergeImageGroupsOnInsert(
        [
            {
                imageVersionId: "img-v1",
                imageId: "img-1",
                segmentIndexStart: 0,
                segmentIndexEnd: 0,
            },
            {
                imageVersionId: "img-v1",
                imageId: "img-1",
                segmentIndexStart: 2,
                segmentIndexEnd: 3,
            },
        ],
        1,
        "img-v1",
        "img-1",
        5
    );
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].segmentIndexStart, 0);
    assert.equal(result.groups[0].segmentIndexEnd, 3);
});

test("mergeImageGroupsOnInsert rejects overlap with different version", () => {
    const result = mergeImageGroupsOnInsert(
        [
            {
                imageVersionId: "img-v1",
                imageId: "img-1",
                segmentIndexStart: 0,
                segmentIndexEnd: 2,
            },
        ],
        1,
        "img-v2",
        "img-2",
        5
    );
    assert.equal(result.error, "Image group overlaps an existing range");
});

test("moveItemByIndex moves item forward", () => {
    const result = moveItemByIndex(["a", "b", "c", "d"], 1, 3);
    assert.deepEqual(result, ["a", "c", "b", "d"]);
});

test("moveItemByIndex moves item backward", () => {
    const result = moveItemByIndex(["a", "b", "c", "d"], 3, 1);
    assert.deepEqual(result, ["a", "d", "b", "c"]);
});

test("moveItemByIndex moves item to end", () => {
    const result = moveItemByIndex(["a", "b", "c", "d"], 1, 4);
    assert.deepEqual(result, ["a", "c", "d", "b"]);
});

test("moveItemByIndexReplace replaces target slot", () => {
    const result = moveItemByIndexReplace(["a", "b", "c", "d"], 1, 2);
    assert.deepEqual(result, ["a", "c", "b", "d"]);
});

test("moveImageGroupsBySlot moves group by slot index", () => {
    const groups = [
        {
            imageVersionId: "v1",
            imageId: "i1",
            segmentIndexStart: 0,
            segmentIndexEnd: 1,
        },
        {
            imageVersionId: "v2",
            imageId: "i2",
            segmentIndexStart: 2,
            segmentIndexEnd: 2,
        },
        {
            imageVersionId: "v3",
            imageId: "i3",
            segmentIndexStart: 3,
            segmentIndexEnd: 3,
        },
    ];
    const result = moveImageGroupsBySlot(groups, 1, 0, 4);
    assert.deepEqual(result, [
        {
            imageVersionId: "v2",
            imageId: "i2",
            segmentIndexStart: 0,
            segmentIndexEnd: 0,
        },
        {
            imageVersionId: "v1",
            imageId: "i1",
            segmentIndexStart: 1,
            segmentIndexEnd: 2,
        },
        {
            imageVersionId: "v3",
            imageId: "i3",
            segmentIndexStart: 3,
            segmentIndexEnd: 3,
        },
    ]);
});

test("moveImageGroupsBySlot merges adjacent same version", () => {
    const groups = [
        {
            imageVersionId: "v1",
            imageId: "i1",
            segmentIndexStart: 0,
            segmentIndexEnd: 0,
        },
        {
            imageVersionId: "v2",
            imageId: "i2",
            segmentIndexStart: 1,
            segmentIndexEnd: 1,
        },
        {
            imageVersionId: "v1",
            imageId: "i1",
            segmentIndexStart: 2,
            segmentIndexEnd: 2,
        },
    ];
    const result = moveImageGroupsBySlot(groups, 2, 1, 4);
    assert.deepEqual(result, [
        {
            imageVersionId: "v1",
            imageId: "i1",
            segmentIndexStart: 0,
            segmentIndexEnd: 1,
        },
        {
            imageVersionId: "v2",
            imageId: "i2",
            segmentIndexStart: 2,
            segmentIndexEnd: 2,
        },
    ]);
});

test("parseDragDataTransfer returns json payload for mime type", () => {
    const dataTransfer = {
        getData: (type) =>
            type === "application/x-loopbox"
                ? JSON.stringify({ type: "music-version", id: "mv-1" })
                : "",
    };
    assert.deepEqual(parseDragDataTransfer(dataTransfer), {
        type: "music-version",
        id: "mv-1",
    });
});

test("parseDragDataTransfer returns fallback payload for text", () => {
    const dataTransfer = {
        getData: (type) => (type === "text/plain" ? "image-version:iv-2" : ""),
    };
    assert.deepEqual(parseDragDataTransfer(dataTransfer), {
        type: "image-version",
        id: "iv-2",
    });
});

test("parseDragDataTransfer returns null for invalid json", () => {
    const dataTransfer = {
        getData: (type) => (type === "application/x-loopbox" ? "{oops" : ""),
    };
    assert.equal(parseDragDataTransfer(dataTransfer), null);
});

test("drag payload helpers store and clear payload", () => {
    clearDragPayload();
    assert.equal(getDragPayload(), null);
    setDragPayload({ type: "music-version", id: "mv-9" });
    assert.deepEqual(getDragPayload(), { type: "music-version", id: "mv-9" });
    clearDragPayload();
    assert.equal(getDragPayload(), null);
});
