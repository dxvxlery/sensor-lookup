import { loadSettings, patchSettings } from "./core";
import { newer } from "./update";
import { RELEASES, type Notes } from "./releases";

export { RELEASES };
export const VERSION: string = __VERSION__;

const KIND: [keyof Notes, string, string][] = [
  ["added", "Новое", "added"],
  ["improved", "Улучшено", "improved"],
  ["fixed", "Исправлено", "fixed"],
];

export function changesSince(prev: string) {
  const fresh = RELEASES.filter((r) => newer(r.version, prev) && !newer(r.version, VERSION));
  return KIND.map(([key, title, type]) => ({ title, type, items: fresh.flatMap((r) => r.ru[key] ?? []) })).filter((c) => c.items.length);
}

export function showChangelog() {
  const s = loadSettings();
  const prev = s.lastVersion || (s.sessionid ? "4.0.0" : "");
  patchSettings({ lastVersion: VERSION });
  if (!prev || prev === VERSION) return;
  const changes = changesSince(prev);
  if (changes.length) BdApi.UI.showChangelogModal({ title: "SensorLookup", subtitle: `Версия ${VERSION}`, changes });
}
