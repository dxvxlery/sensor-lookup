import { loadSettings, patchSettings } from "./core";
import { newer } from "./update";

export const VERSION: string = __VERSION__;

interface Release {
  version: string;
  added?: string[];
  improved?: string[];
  fixed?: string[];
}

export const RELEASES: Release[] = [
  {
    version: "4.1.0",
    added: [
      "Окно «что нового» после обновления.",
      "Автообновление: плагин сам проверяет новую версию и предлагает обновиться.",
      "Кнопка «Проверить обновления» в настройках.",
    ],
    improved: ["Если вкладка не смогла показать данные, ломается только она, остальное окно работает."],
  },
  {
    version: "4.0.0",
    added: [
      "Поиск в друзьях и серверах, сортировка серверов, фильтр ников по серверу.",
      "Итоги и группировка по дням в совместных голосовых.",
      "Срок cf_clearance в настройках, приватный режим кеша.",
    ],
    improved: ["Кеш в отдельном файле с лимитом по размеру.", "Меньше запросов, плагин в полтора раза легче."],
    fixed: ["Ответ «слишком много запросов» обрабатывается с паузой и повтором."],
  },
];

const KIND: [keyof Release, string, string][] = [
  ["added", "Новое", "added"],
  ["improved", "Улучшено", "improved"],
  ["fixed", "Исправлено", "fixed"],
];

export function changesSince(prev: string) {
  const fresh = RELEASES.filter((r) => newer(r.version, prev) && !newer(r.version, VERSION));
  return KIND.map(([key, title, type]) => ({ title, type, items: fresh.flatMap((r) => (r[key] as string[] | undefined) ?? []) })).filter(
    (c) => c.items.length,
  );
}

export function showChangelog() {
  const s = loadSettings();
  const prev = s.lastVersion || (s.sessionid ? "4.0.0" : "");
  patchSettings({ lastVersion: VERSION });
  if (!prev || prev === VERSION) return;
  const changes = changesSince(prev);
  if (changes.length) BdApi.UI.showChangelogModal({ title: "SensorLookup", subtitle: `Версия ${VERSION}`, changes });
}
