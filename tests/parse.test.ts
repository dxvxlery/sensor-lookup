import "./stub";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVoice, parseTokens, classifyClip, cleanToken, threadComments, sessionSummary } from "../src/parse";

const SID = "11111111-2222-3333-4444-555555555555";
const CF = "AbC" + "x9_-Q".repeat(40);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";

test("currently in voice", () => {
  const v = parseVoice({
    voice_info: {
      status: "in_current_voice",
      guild_id: "1",
      channel_id: "2",
      channel_name: "General",
      category_name: "──〢Lounge",
      server_name: "Test",
      server_avatar: "a_x",
      current_session_duration_sec: 685,
    },
    self_mute: true,
  });
  assert.equal(v?.live, true);
  assert.equal(v?.category, "Lounge");
  assert.equal(v?.sessionSec, 685);
  assert.equal(v?.flags.mute, true);
  assert.equal(v?.icon, "https://cdn.discordapp.com/icons/1/a_x.gif?size=96");
});

test("last voice and empty", () => {
  const v = parseVoice({ voice_info: { status: "last_voice", channel_name: "Club", last_voice_time: "2026-01-01T00:00:00Z" } });
  assert.equal(v?.live, false);
  assert.equal(v?.lastTime, "2026-01-01T00:00:00Z");
  assert.equal(parseVoice({}), null);
  assert.equal(parseVoice(null), null);
});

test("cURL: bash, cmd, PowerShell", () => {
  const bash = `curl 'https://x' -b 'cf_clearance=${CF}; _ga=1; sessionid=${SID}' -H 'user-agent: ${UA}'`;
  const cmd = `curl ^"https://x^" -b ^"cf_clearance=${CF}; sessionid=${SID}^" -H ^"user-agent: ${UA}^"`;
  const ps = `$session.UserAgent = "${UA}"\n$session.Cookies.Add((New-Object System.Net.Cookie("sessionid", "${SID}", "/", "x")))`;
  for (const t of [bash, cmd]) assert.deepEqual(parseTokens(t), { sessionid: SID, cfClearance: CF, userAgent: UA });
  assert.deepEqual(parseTokens(ps), { sessionid: SID, cfClearance: null, userAgent: UA });
});

test("clipboard: what is recognised and what is ignored", () => {
  assert.deepEqual(classifyClip(CF), { cfClearance: CF });
  assert.deepEqual(classifyClip(SID), { sessionid: SID });
  assert.deepEqual(classifyClip(`sessionid=${SID};`), { sessionid: SID });
  assert.deepEqual(classifyClip(UA), { userAgent: UA });
  assert.deepEqual(classifyClip("eyJ" + "a".repeat(120) + ".b.c"), {});
  assert.deepEqual(classifyClip("MTA" + "x".repeat(40) + ".Gabcd." + "y".repeat(60)), {});
  assert.deepEqual(classifyClip("just some text"), {});
  assert.equal(cleanToken("cfClearance", ` "cf_clearance=${CF}; path=/" `), CF);
});

test("comment threads", () => {
  const roots = threadComments([
    { comment_id: 1, date: "2026-01-01", pinned: false },
    { comment_id: 2, parent_comment_id: 1, date: "2026-01-02" },
    { comment_id: 3, date: "2026-01-03", pinned: true },
    { comment_id: 4, date: "2026-01-04" },
  ]);
  assert.deepEqual(
    roots.map((r) => r.c.comment_id),
    [3, 4, 1],
  );
  assert.deepEqual(
    roots[2].replies.map((r) => r.c.comment_id),
    [2],
  );
});

test("shared session summary", () => {
  const s = sessionSummary([
    { overlap_seconds: 600, channel: { name: "A" } },
    { overlap_seconds: 300, channel: { name: "B" } },
    { overlap_seconds: 400, channel: { name: "B" } },
  ]);
  assert.equal(s.total, 1300);
  assert.deepEqual(s.top, { name: "B", sec: 700 });
});
