const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getStatusBadgeVariant } = require("../src/lib/status-badge");
const { getMusicDisplayName } = require("../src/lib/music-display");
const { buildCreateMusicRequest } = require("../src/lib/music-create");

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
