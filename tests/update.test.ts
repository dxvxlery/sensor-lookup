import "./stub";
import { test } from "node:test";
import assert from "node:assert/strict";
import { newer, remoteVersion } from "../src/update";
import { changesSince, RELEASES, VERSION } from "../src/changelog";

test("version comparison", () => {
  assert.equal(newer("4.1.0", "4.0.9"), true);
  assert.equal(newer("4.10.0", "4.9.0"), true);
  assert.equal(newer("4.1", "4.1.0"), false);
  assert.equal(newer("4.0.0", "4.0.0"), false);
  assert.equal(newer("3.9.9", "4.0.0"), false);
});

test("version from the file header", () => {
  assert.equal(remoteVersion("/**\n * @name SensorLookup\n * @version 4.2.1\n */"), "4.2.1");
  assert.equal(remoteVersion("<html>404</html>"), null);
});

test("changelog includes only releases after the previous version", () => {
  assert.equal(RELEASES[0].version, VERSION);
  const fromPrev = changesSince(RELEASES[1].version);
  const items = fromPrev.flatMap((c) => c.items);
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => [...(RELEASES[0].added ?? []), ...(RELEASES[0].improved ?? []), ...(RELEASES[0].fixed ?? [])].includes(i)));
  assert.deepEqual(changesSince(VERSION), []);
});
