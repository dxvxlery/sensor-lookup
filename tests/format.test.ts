import "./stub";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtDur, fmtHours, fmtNum, relTime, toDate, userAvatar, guildIcon, initials } from "../src/format";

test("durations are in seconds", () => {
  assert.equal(fmtDur(26666085), "308 д 15 ч");
  assert.equal(fmtDur(1847), "30 мин");
  assert.equal(fmtDur(14940), "4 ч 9 мин");
  assert.equal(fmtDur(35), "35 сек");
  assert.equal(fmtDur("0"), "—");
  assert.equal(fmtDur(null), "—");
  assert.equal(fmtHours(26666085).replace(/\s/g, " "), "7 407 ч 14 мин");
});

test("numbers and dates", () => {
  assert.equal(fmtNum(131231).replace(/\s/g, " "), "131 231");
  assert.equal(fmtNum("abc"), "—");
  assert.equal(toDate("bad"), null);
  assert.equal(toDate(1700000000)?.getTime(), 1700000000000);
  assert.equal(relTime(new Date(Date.now() - 5 * 60e3)), "5 мин назад");
  assert.equal(relTime(new Date(Date.now() - 3 * 86400e3)), "3 д назад");
  assert.equal(relTime(new Date(Date.now() + 1000)), "");
});

test("CDN urls", () => {
  assert.equal(userAvatar("1", "a_hash"), "https://cdn.discordapp.com/avatars/1/a_hash.gif?size=64");
  assert.equal(userAvatar("1", null), null);
  assert.equal(guildIcon("2", "abc", 96), "https://cdn.discordapp.com/icons/2/abc.png?size=96");
  assert.equal(guildIcon(null, "abc"), null);
  assert.equal(initials("john smith"), "JS");
});
