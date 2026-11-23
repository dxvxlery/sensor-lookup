import { BASE, GUIDE, loadSettings, sleep } from "./core";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfter = 0,
  ) {
    super(message);
  }
}

let coolUntil = 0;

export function authHeaders(referer?: string, accept = "*/*") {
  const s = loadSettings();
  const missing = [!s.sessionid && "sessionid", !s.cfClearance && "cf_clearance", !s.userAgent && "User-Agent"].filter(Boolean);
  if (missing.length) throw new ApiError(`Не заданы токены: ${missing.join(", ")}.\nОткрой ${GUIDE} — там пошагово.`);
  return {
    accept,
    "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    cookie: `sessionid=${s.sessionid.trim()}; cf_clearance=${s.cfClearance.trim()}`,
    referer: BASE + (referer || "/"),
    "user-agent": s.userAgent.trim(),
  };
}

export function retrySeconds(header: string | null | undefined, text: string) {
  const h = Number(header);
  if (h > 0) return h;
  try {
    const j = JSON.parse(text);
    const v = Number(j.retry_after ?? j.retryAfter ?? j.retry_after_ms / 1000);
    if (v > 0) return v;
  } catch {}
  return 10;
}

function cfAge() {
  const t = loadSettings().cfSavedAt;
  const hrs = t ? Math.floor((Date.now() - t) / 3600e3) : 0;
  return hrs ? ` (вставлена ${hrs} ч назад)` : "";
}

export async function request(url: string, referer?: string, accept?: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const wait = coolUntil - Date.now();
    if (wait > 0) {
      if (wait > 15000) throw new ApiError(`Сайт просит подождать ещё ${Math.ceil(wait / 1000)} с.`, 429, wait / 1000);
      await sleep(wait);
    }
    const res: Response = await BdApi.Net.fetch(url, { method: "GET", headers: authHeaders(referer, accept) });
    if (res.status !== 429) return res;
    const sec = retrySeconds(res.headers?.get?.("retry-after"), await res.text());
    coolUntil = Date.now() + sec * 1000;
    if (attempt >= 1 || sec > 15) throw new ApiError(`Слишком много запросов. Сайт просит подождать ${Math.ceil(sec)} с.`, 429, sec);
  }
}

export async function apiGet(path: string, referer?: string): Promise<any> {
  const res = await request(BASE + path, referer);
  const text = await res.text();
  const cf = /cloudflare|cf-chl|challenge-platform/i.test(text);
  if (!res.ok) {
    if (cf)
      throw new ApiError(
        `Cloudflare не пустил (HTTP ${res.status}).\nСкорее всего cf_clearance протухла${cfAge()} или сменился IP/браузер. Обнови сайт в браузере и скопируй cf_clearance заново: ${GUIDE}, шаг 3.`,
        res.status,
      );
    if (res.status === 401 || res.status === 403)
      throw new ApiError(
        `Доступ запрещён (HTTP ${res.status}).\nОбычно это протухшая cf_clearance${cfAge()}: обнови сайт в браузере и скопируй её заново (${GUIDE}, шаг 3). Не помогло — возьми заново sessionid (шаг 4).`,
        res.status,
      );
    throw new ApiError(`HTTP ${res.status}\n${text.slice(0, 200)}`, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(
      cf
        ? `Cloudflare вернул страницу проверки.\nОбнови cf_clearance и User-Agent: ${GUIDE}, шаги 3 и 5.`
        : "Ответ не JSON:\n" + text.slice(0, 200),
      res.status,
    );
  }
}
