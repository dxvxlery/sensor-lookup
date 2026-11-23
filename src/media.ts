import { BASE } from "./core";
import { request } from "./net";

export const MEDIA_TYPES: [string, string, string][] = [
  ["avatars", "Аватары", "e20"],
  ["streams", "Скриншоты экрана", "e23"],
  ["deleted", "Удалённые", "e21"],
];
const PREFIX = Object.fromEntries(MEDIA_TYPES.map(([k, , p]) => [k, p]));

export function mediaUrl(type: string, id: string | number, big = false) {
  const base = `${BASE}/api/attachments/${PREFIX[type] || "e20"}/${id}`;
  if (type === "streams") return base + (big ? "?height=720&width=1280" : "?height=288&width=512");
  return `${base}?size=${big ? 1024 : 512}`;
}

const MAX = 150;
const cache = new Map<string, Promise<string>>();
const queue: Array<() => void> = [];
let active = 0;

function run<T>(task: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const go = () => {
      active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          queue.shift()?.();
        });
    };
    active < 4 ? go() : queue.push(go);
  });
}

const revoke = (p: Promise<string>) =>
  p.then(
    (u) => URL.revokeObjectURL(u),
    () => {},
  );

export function loadBlob(url: string, referer?: string) {
  const hit = cache.get(url);
  if (hit) {
    cache.delete(url);
    cache.set(url, hit);
    return hit;
  }
  const p = run(async () => {
    const res = await request(url, referer, "image/*");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob =
      typeof res.blob === "function"
        ? await res.blob()
        : new Blob([await (res as Response).arrayBuffer()], { type: res.headers?.get?.("content-type") || "image/jpeg" });
    return URL.createObjectURL(blob);
  });
  p.catch(() => cache.delete(url));
  cache.set(url, p);
  for (const [k, old] of cache) {
    if (cache.size <= MAX) break;
    cache.delete(k);
    revoke(old);
  }
  return p;
}

export function freeBlobs() {
  cache.forEach(revoke);
  cache.clear();
}
