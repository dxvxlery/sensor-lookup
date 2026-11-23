import { h, useState, useEffect, useRef, BASE, loadSettings, patchSettings, toast, copy, type Settings } from "../core";
import { api } from "../api";
import { cacheStats, clearCache } from "../cache";
import { VERSION } from "../changelog";
import { UPDATE_URL, checkUpdate } from "../update";
import { parseTokens, classifyClip, cleanToken, type Tokens, type TokenKey } from "../parse";

const LABEL: Record<TokenKey, string> = { cfClearance: "cf_clearance", sessionid: "sessionid", userAgent: "User-Agent" };
const ORDER: TokenKey[] = ["cfClearance", "sessionid", "userAgent"];
const UA_CMD = "copy(navigator.userAgent)";
const CURL_HINT = "Другой способ: F12 → Network → ПКМ по запросу get-user-info → Copy → Copy as cURL, вставь сюда.";

async function readClipboard(): Promise<string | null> {
  try {
    const t = await DiscordNative?.clipboard?.read?.();
    if (typeof t === "string") return t;
  } catch {}
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

function writeClipboard(text: string) {
  try {
    DiscordNative.clipboard.copy(text);
  } catch {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
}

function useClipboardWatch(apply: (t: Tokens) => boolean) {
  const [ok, setOk] = useState(true);
  const last = useRef<string | null>(null);
  const fn = useRef(apply);
  fn.current = apply;
  useEffect(() => {
    let alive = true;
    let fails = 0;
    const check = async () => {
      const t = await readClipboard();
      if (!alive) return;
      if (t == null) return ++fails >= 3 && setOk(false);
      fails = 0;
      setOk(true);
      if (t === last.current) return;
      last.current = t;
      const found = classifyClip(t);
      if (Object.keys(found).length && fn.current(found)) {
        writeClipboard("");
        last.current = "";
      }
    };
    check();
    const timer = setInterval(check, 800);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);
  return ok;
}

const kbd = (k: string) => h("kbd", null, k);
const code = (t: string) => h("code", null, t);

const ago = (t: number) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} мин назад` : `${Math.floor(m / 60)} ч назад`;
};

const cfStale = (s: Settings) => !!s.cfSavedAt && Date.now() - s.cfSavedAt > 12 * 3600e3;

function myId(): string | null {
  try {
    return BdApi.Webpack.getStore?.("UserStore")?.getCurrentUser?.()?.id ?? null;
  } catch {
    return null;
  }
}

function describe(k: TokenKey, s: Settings) {
  const v = s[k];
  if (!v) return "не задано";
  if (k === "cfClearance") return s.cfSavedAt ? `вставлена ${ago(s.cfSavedAt)}` : "задана";
  if (k === "userAgent") return /Chrome\/\d+/.exec(v)?.[0].replace("/", " ") || /Firefox\/\d+/.exec(v)?.[0].replace("/", " ") || "задан";
  return "задан";
}

const Switch = ({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note?: string }) =>
  h(
    "label",
    { className: "sl-s-row" },
    h("span", { className: "sl-s-label" }, label, note ? h("small", null, note) : null),
    h("input", { type: "checkbox", role: "switch", className: "sl-s-sw", checked: on, onChange: (e) => onChange(e.target.checked) }),
  );

const NumRow = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) =>
  h(
    "label",
    { className: "sl-s-row" },
    h("span", { className: "sl-s-label" }, label),
    h("input", { type: "number", min: 0, className: "sl-s-num", value, onChange: (e) => onChange(Number(e.target.value)) }),
  );

type Check = { state: "idle" | "busy" | "ok" | "fail"; text?: string };

export function SettingsPanel() {
  const [s, setS] = useState<Settings>(loadSettings);
  const [stats, setStats] = useState(cacheStats);
  const [flash, setFlash] = useState<string[]>([]);
  const [edit, setEdit] = useState<TokenKey | null>(null);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [conn, setConn] = useState<Check>({ state: "idle" });
  const [help, setHelp] = useState(() => ORDER.some((k) => !loadSettings()[k]));

  const patch = (p: Partial<Settings>) => setS(patchSettings(p));

  const applyFound = (fields: Tokens) => {
    const cur = loadSettings();
    const changed = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v && cur[k as TokenKey] !== v)) as Partial<Settings>;
    const keys = Object.keys(changed);
    if (!keys.length) return false;
    patch(changed);
    setFlash(keys);
    setConn({ state: "idle" });
    setTimeout(() => setFlash([]), 1600);
    toast(`Сохранено: ${keys.map((k) => LABEL[k as TokenKey]).join(", ")}`, "success");
    return true;
  };

  const clipOk = useClipboardWatch(applyFound);
  const missing = ORDER.filter((k) => !s[k]);
  const stale = cfStale(s);

  const testConn = async () => {
    const id = myId();
    if (!id) return setConn({ state: "fail", text: "Не удалось узнать твой ID в Discord." });
    setConn({ state: "busy" });
    try {
      await api.info(id, true);
      setConn({ state: "ok", text: "Работает." });
    } catch (e: any) {
      setConn({ state: "fail", text: String(e?.message || e).split("\n")[0] });
    }
  };

  const status = missing.length
    ? `Не хватает: ${missing.map((k) => LABEL[k]).join(", ")}.`
    : stale
      ? "cf_clearance вставлена больше 12 часов назад и, скорее всего, уже не действует."
      : conn.state === "ok"
        ? "Подключено, сайт отвечает."
        : "Все значения на месте.";

  const tokenRow = (k: TokenKey) =>
    h(
      "div",
      { key: k, className: "sl-s-row" + (flash.includes(k) ? " is-new" : "") },
      h("span", { className: "sl-s-label" }, h("code", null, LABEL[k])),
      edit === k
        ? h("input", {
            className: "sl-s-input",
            autoFocus: true,
            type: k === "userAgent" ? "text" : "password",
            value: s[k] || "",
            spellCheck: false,
            onChange: (e) => patch({ [k]: cleanToken(k, e.target.value) }),
            onBlur: () => setEdit(null),
            onKeyDown: (e: KeyboardEvent) => e.key === "Enter" && setEdit(null),
          })
        : h(
            "span",
            { className: "sl-s-value" + (s[k] ? "" : " is-empty") + (k === "cfClearance" && stale ? " is-warn" : "") },
            describe(k, s),
          ),
      edit === k ? null : h("button", { className: "sl-s-text", onClick: () => setEdit(k) }, s[k] ? "Изменить" : "Ввести"),
    );

  return h(
    "div",
    { className: "sl-s" },
    h(
      "section",
      null,
      h("h3", null, "Аккаунт discord-sensor.com"),
      h("p", { className: "sl-s-status" + (missing.length || stale ? " is-warn" : "") }, status),
      h(
        "div",
        { className: "sl-s-buttons" },
        h("button", { className: "sl-s-btn", onClick: () => window.open(BASE, "_blank") }, "Открыть сайт"),
        missing.length
          ? null
          : h(
              "button",
              { className: "sl-s-btn is-primary", disabled: conn.state === "busy", onClick: testConn },
              conn.state === "busy" ? "Проверяю…" : "Проверить",
            ),
      ),
      conn.state === "fail" ? h("p", { className: "sl-s-error" }, conn.text) : null,
      h("div", { className: "sl-s-list" }, ORDER.map(tokenRow)),
      h(
        "p",
        { className: "sl-s-hint" },
        clipOk
          ? "Пока открыта эта страница, скопированные значения подставляются сами, а буфер потом очищается."
          : "Буфер обмена недоступен — вставляй значения кнопкой «Ввести».",
      ),
    ),

    h(
      "section",
      null,
      h(
        "button",
        { className: "sl-s-toggle", "aria-expanded": help, onClick: () => setHelp(!help) },
        h("h3", null, "Где взять значения"),
        h("span", null, help ? "Скрыть" : "Показать"),
      ),
      help
        ? h(
            "div",
            { className: "sl-s-help" },
            h(
              "ol",
              null,
              h("li", null, "Войди на discord-sensor.com и открой профиль любого человека."),
              h(
                "li",
                null,
                kbd("F12"),
                " → Application → Cookies → discord-sensor.com. Двойной клик по значению ",
                code("cf_clearance"),
                ", ",
                kbd("Ctrl+C"),
                ". Затем то же для ",
                code("sessionid"),
                ".",
              ),
              h(
                "li",
                null,
                "Во вкладке Console выполни ",
                h("button", { className: "sl-s-cmd", title: "Скопировать", onClick: () => copy(UA_CMD, "Команда") }, UA_CMD),
                ".",
              ),
            ),
            h(
              "p",
              null,
              "Если сайт снова отвечает 403, обнови его в браузере и скопируй cf_clearance заново: она живёт несколько часов и привязана к IP.",
            ),
            h("p", null, CURL_HINT),
            h(
              "div",
              { className: "sl-s-curl" },
              h("textarea", {
                className: "sl-s-input",
                rows: 2,
                value: paste,
                placeholder: "curl 'https://discord-sensor.com/api/tracker/…'",
                onChange: (e) => setPaste(e.target.value),
              }),
              h(
                "button",
                {
                  className: "sl-s-btn",
                  disabled: !paste.trim(),
                  onClick: () => (applyFound(parseTokens(paste)) ? setPaste("") : toast("В этом тексте нет новых значений", "error")),
                },
                "Разобрать",
              ),
            ),
          )
        : null,
    ),

    h(
      "section",
      null,
      h("h3", null, "Кеш"),
      h(NumRow, { label: "Хранить, часов", value: s.cacheHours, onChange: (v) => patch({ cacheHours: v }) }),
      h(NumRow, { label: "Размер, МБ", value: s.cacheMb, onChange: (v) => patch({ cacheMb: v }) }),
      h(Switch, { label: "Не сохранять комментарии и медиа на диск", on: s.privateCache, onChange: (v) => patch({ privateCache: v }) }),
      h(Switch, { label: "Очищать при выключении плагина", on: s.clearOnStop, onChange: (v) => patch({ clearOnStop: v }) }),
      h(
        "div",
        { className: "sl-s-row" },
        h("span", { className: "sl-s-label" }, `Сейчас ${stats.n} запросов, ${stats.kb} КБ`),
        h(
          "button",
          {
            className: "sl-s-text is-danger",
            disabled: !stats.n,
            onClick: () => {
              clearCache();
              setStats(cacheStats());
            },
          },
          "Очистить",
        ),
      ),
    ),

    h(
      "section",
      null,
      h("h3", null, "Обновления"),
      UPDATE_URL
        ? [
            h(Switch, { key: "s", label: "Проверять автоматически", on: s.autoUpdate, onChange: (v) => patch({ autoUpdate: v }) }),
            h(
              "div",
              { key: "r", className: "sl-s-row" },
              h("span", { className: "sl-s-label" }, `Версия ${VERSION}`),
              h(
                "button",
                {
                  className: "sl-s-text",
                  disabled: busy,
                  onClick: async () => {
                    setBusy(true);
                    await checkUpdate(VERSION, true);
                    setBusy(false);
                  },
                },
                busy ? "Проверяю…" : "Проверить",
              ),
            ),
          ]
        : h(
            "div",
            { className: "sl-s-row" },
            h("span", { className: "sl-s-label" }, `Версия ${VERSION}`),
            h("span", { className: "sl-s-value is-empty" }, "обновление вручную"),
          ),
    ),
  );
}

export function openSettingsModal() {
  BdApi.UI.showConfirmationModal("SensorLookup", h(SettingsPanel), { confirmText: "Готово", cancelText: null });
}
