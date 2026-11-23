import { num, guildIcon } from "./format";

export type TokenKey = "sessionid" | "cfClearance" | "userAgent";
export type Tokens = Partial<Record<TokenKey, string | null>>;

export interface Voice {
  live: boolean;
  guildId?: string;
  channelId?: string;
  channel?: string;
  category: string | null;
  guild?: string;
  icon: string | null;
  sessionSec: number | null;
  lastTime: string | null;
  others: any[];
  flags: { mute: boolean; deaf: boolean; stream: boolean; video: boolean };
}

export function parseVoice(json: any): Voice | null {
  const vi = json?.voice_info;
  if (!vi?.status) return null;
  return {
    live: vi.status === "in_current_voice",
    guildId: vi.guild_id,
    channelId: vi.channel_id,
    channel: vi.channel_name,
    category: vi.category_name ? vi.category_name.replace(/^[─\-\s〢|]+/, "") : null,
    guild: vi.server_name,
    icon: guildIcon(vi.guild_id, vi.server_avatar, 96),
    sessionSec: num(vi.current_session_duration_sec),
    lastTime: vi.last_voice_time || null,
    others: Array.isArray(vi.others_in_channel) ? vi.others_in_channel : [],
    flags: { mute: !!json.self_mute, deaf: !!json.self_deaf, stream: !!json.self_stream, video: !!json.self_video },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTokens(text: unknown): Record<TokenKey, string | null> {
  const t = String(text || "").trim();
  const r: Record<TokenKey, string | null> = { sessionid: null, cfClearance: null, userAgent: null };
  if (!t) return r;
  try {
    const j = JSON.parse(t);
    if (j && typeof j === "object") {
      r.sessionid = j.sessionid || null;
      r.cfClearance = j.cf_clearance || j.cfClearance || null;
      r.userAgent = j.userAgent || j.user_agent || null;
      return r;
    }
  } catch {}
  const clean = t.replace(/\^(.)/g, "$1");
  const cookie = (name: string) =>
    clean.match(new RegExp(`(?:^|[\\s;'"])${name}=([^;'"\\s]+)`))?.[1] ||
    clean.match(new RegExp(`Cookie\\(\\s*["']${name}["']\\s*,\\s*["']([^"']+)`))?.[1] ||
    null;
  r.sessionid = cookie("sessionid");
  r.cfClearance = cookie("cf_clearance");
  const ua =
    clean.match(/user-agent["']?\s*[:=]\s*["']?([^"'\r\n]+)/i) ||
    clean.match(/-UserAgent\s+["']([^"']+)/i) ||
    clean.match(/\.UserAgent\s*=\s*["']([^"']+)/i);
  if (ua)
    r.userAgent = ua[1]
      .trim()
      .replace(/[\\`]$/, "")
      .trim();
  if (!r.sessionid && UUID.test(t)) r.sessionid = t;
  return r;
}

export function classifyClip(text: unknown): Tokens {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 20000) return {};
  if (/\n|curl\s|cookie:|-b\s|^\{/i.test(raw)) return Object.fromEntries(Object.entries(parseTokens(raw)).filter(([, v]) => v));
  const t = raw.replace(/^["']|["']$/g, "");
  if (/^sessionid=/i.test(t)) return { sessionid: t.slice(10).split(";")[0].trim() };
  if (/^cf_clearance=/i.test(t)) return { cfClearance: t.slice(13).split(";")[0].trim() };
  if (UUID.test(t)) return { sessionid: t };
  if (/^Mozilla\/5\.0 \(/.test(t)) return { userAgent: t };
  if (/^[\w\-.]{100,}$/.test(t) && !/^eyJ/.test(t) && !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(t)) return { cfClearance: t };
  return {};
}

export function cleanToken(key: TokenKey, v: unknown) {
  let t = String(v || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const name = ({ cfClearance: "cf_clearance", sessionid: "sessionid" } as Record<string, string>)[key];
  if (!name) return t;
  if (t.startsWith(name + "=")) t = t.slice(name.length + 1);
  return t.split(";")[0].trim();
}

export const tokenOk = (key: TokenKey, v: string) =>
  key === "sessionid" ? /^[0-9a-f-]{20,}$/i.test(v) : key === "cfClearance" ? v.length > 40 : /Mozilla\/5\.0/.test(v);

export interface Thread {
  c: any;
  replies: Thread[];
}

export function threadComments(list: any[]): Thread[] {
  const nodes = new Map<unknown, Thread>(list.map((c) => [c.comment_id, { c, replies: [] }]));
  const roots: Thread[] = [];
  for (const n of nodes.values()) {
    const p = n.c.parent_comment_id != null && nodes.get(n.c.parent_comment_id);
    (p ? p.replies : roots).push(n);
  }
  const time = (n: Thread) => new Date(n.c.date).getTime();
  for (const n of nodes.values()) n.replies.sort((a, b) => time(a) - time(b));
  return roots.sort((a, b) => (b.c.pinned ? 1 : 0) - (a.c.pinned ? 1 : 0) || time(b) - time(a));
}

export function sessionSummary(list: any[]) {
  const total = list.reduce((a, s) => a + (num(s.overlap_seconds) || 0), 0);
  const by = new Map<string, number>();
  for (const s of list) {
    const k = s.channel?.name || "?";
    by.set(k, (by.get(k) || 0) + (num(s.overlap_seconds) || 0));
  }
  const top = [...by].sort((a, b) => b[1] - a[1])[0];
  return { count: list.length, total, top: top ? { name: top[0], sec: top[1] } : null };
}
