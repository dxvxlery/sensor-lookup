import { NAME, loadSettings } from "./core";
import { apiGet } from "./net";

export interface Loaded<T = any> {
  data: T;
  at: number;
  fromCache: boolean;
}
interface Entry {
  t: number;
  d: unknown;
  s: number;
}

const FILE = NAME + "Cache";
let mem: Record<string, Entry> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const inflight = new Map<string, Promise<Loaded>>();

const store = () => (mem ??= (BdApi.Data.load(FILE, "entries") as Record<string, Entry>) || {});

const ttl = () => {
  const h = Number(loadSettings().cacheHours);
  return (Number.isFinite(h) && h >= 0 ? h : 12) * 3600e3;
};

const limit = () => Math.max(0.5, Number(loadSettings().cacheMb) || 3) * 1048576;

export function prune(c = store(), now = Date.now(), max = ttl(), cap = limit()) {
  let size = 0;
  const keys = Object.keys(c).filter((k) => {
    if (!c[k] || now - c[k].t > max) return delete c[k], false;
    size += c[k].s || 0;
    return true;
  });
  if (size <= cap) return;
  keys.sort((a, b) => c[a].t - c[b].t);
  for (const k of keys) {
    if (size <= cap * 0.8) break;
    size -= c[k].s || 0;
    delete c[k];
  }
}

export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (mem) BdApi.Data.save(FILE, "entries", mem);
}

export function clearCache() {
  mem = {};
  flush();
}

export const pendingSave = () => !!timer;

export function cacheStats() {
  const c = store();
  const keys = Object.keys(c);
  return { n: keys.length, kb: Math.round(keys.reduce((a, k) => a + (c[k].s || 0), 0) / 1024) };
}

export function slim(path: string, d: any) {
  if (!path.includes("get-user-info") || !d || typeof d !== "object") return d;
  const { rating_state: _r, tabs: _t, ...rest } = d;
  if (rest.customization) rest.customization = { banner_text: rest.customization.banner_text };
  return rest;
}

const isPrivate = (path: string) => /get-comments|photos\/list/.test(path);

export function cachedGet(path: string, referer: string, force?: boolean): Promise<Loaded> {
  const c = store();
  const hit = c[path];
  const max = ttl();
  if (!force && max > 0 && hit && Date.now() - hit.t <= max) return Promise.resolve({ data: hit.d, at: hit.t, fromCache: true });
  const running = inflight.get(path);
  if (running) return running;
  const p = apiGet(path, referer)
    .then((raw) => {
      const data = slim(path, raw);
      if (max > 0 && !(loadSettings().privateCache && isPrivate(path))) {
        c[path] = { t: Date.now(), d: data, s: JSON.stringify(data).length };
        prune(c);
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 1500);
      }
      return { data, at: Date.now(), fromCache: false };
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}
