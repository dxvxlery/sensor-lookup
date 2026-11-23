import { calls, setResponses, disk } from "./stub";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cachedGet, prune, slim, clearCache, flush } from "../src/cache";
import { retrySeconds } from "../src/net";

test("repeat requests hit the cache, concurrent ones are deduplicated", async () => {
  clearCache();
  calls.length = 0;
  setResponses([{ status: 200, body: { n: 1 } }]);
  const [a, b] = await Promise.all([cachedGet("/api/x", "/"), cachedGet("/api/x", "/")]);
  assert.equal(calls.length, 1);
  assert.equal(a, b);
  const c = await cachedGet("/api/x", "/");
  assert.equal(c.fromCache, true);
  assert.deepEqual(c.data, { n: 1 });
  setResponses([{ status: 200, body: { n: 2 } }]);
  const d = await cachedGet("/api/x", "/", true);
  assert.deepEqual(d.data, { n: 2 });
  flush();
  assert.ok((disk.SensorLookupCache?.entries as any)["/api/x"]);
});

test("user info is slimmed before caching", () => {
  const s = slim("/api/tracker/get-user-info?content=1", {
    a: 1,
    rating_state: {},
    tabs: {},
    customization: { username_css: "x".repeat(500), banner_text: "hi" },
  });
  assert.deepEqual(s, { a: 1, customization: { banner_text: "hi" } });
});

test("cache is pruned by age and by size", () => {
  const now = 1_000_000;
  const c: Record<string, { t: number; d: unknown; s: number }> = {
    old: { t: now - 10_000, d: 0, s: 10 },
    a: { t: now - 3, d: 0, s: 400 },
    b: { t: now - 2, d: 0, s: 400 },
    c: { t: now - 1, d: 0, s: 400 },
  };
  prune(c, now, 5_000, 1000);
  assert.deepEqual(Object.keys(c).sort(), ["b", "c"]);
});

test("429: waits and retries", async () => {
  clearCache();
  calls.length = 0;
  setResponses([
    { status: 429, body: { retry_after: 0.05 } },
    { status: 200, body: { ok: 1 } },
  ]);
  const r = await cachedGet("/api/y", "/");
  assert.equal(calls.length, 2);
  assert.deepEqual(r.data, { ok: 1 });
  assert.equal(retrySeconds("3", ""), 3);
  assert.equal(retrySeconds(null, '{"retry_after":2}'), 2);
  assert.equal(retrySeconds(null, "x"), 10);
});

test("403 produces a readable error", async () => {
  clearCache();
  setResponses([{ status: 403, body: "<html>forbidden</html>" }]);
  await assert.rejects(cachedGet("/api/z", "/"), (e: any) => e.status === 403 && /cf_clearance/.test(e.message));
});
