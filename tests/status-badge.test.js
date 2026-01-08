const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getStatusBadgeVariant } = require("../src/lib/status-badge");

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
