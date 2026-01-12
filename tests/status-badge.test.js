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
