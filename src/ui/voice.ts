import { h, useState, useEffect, useRef, goChannel } from "../core";
import { api } from "../api";
import { fmtDur, fmtDate, relTime, userAvatar } from "../format";
import { parseVoice, type Voice } from "../parse";
import { Avatar, IconBtn, type LoadState } from "./common";

const POLL = 30000;

export function VoiceNow({ uid, info }: { uid: string; info: LoadState }) {
  const [st, setSt] = useState<{ loading: boolean; voice: Voice | null; error: string | null; at: number }>({
    loading: true,
    voice: null,
    error: null,
    at: 0,
  });
  const [, tick] = useState(0);
  const [nonce, setNonce] = useState(0);
  const seeded = useRef(false);
  const lastAt = useRef(0);
  lastAt.current = st.at;
  const waiting = info.loading && info.data == null;
  const fresh = !info.loading && info.data && Date.now() - info.at < 60000;

  useEffect(() => {
    if (fresh && !seeded.current) {
      seeded.current = true;
      setSt({ loading: false, voice: parseVoice(info.data), error: null, at: info.at });
    }
  }, [fresh]);

  useEffect(() => {
    if (waiting) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(load, POLL);
    };
    const load = () => {
      if (document.hidden) return schedule();
      setSt((s) => ({ ...s, loading: true }));
      api
        .voiceNow(uid)
        .then(
          (j: any) => alive && setSt({ loading: false, voice: parseVoice(j), error: null, at: Date.now() }),
          (e: any) => alive && setSt((s) => ({ ...s, loading: false, error: e?.message || String(e) })),
        )
        .finally(() => alive && schedule());
    };
    const onVis = () => {
      if (!document.hidden && Date.now() - lastAt.current > POLL) load();
    };
    if (nonce || !seeded.current) load();
    else schedule();
    const clock = setInterval(() => !document.hidden && tick((n) => n + 1), 10000);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [uid, nonce, waiting]);

  const v = st.voice;
  const refresh = h(IconBtn, {
    icon: "refresh",
    size: 16,
    className: st.loading ? "spin" : "",
    title: `Обновить (само — раз в ${POLL / 1000} с)`,
    onClick: () => setNonce((n) => n + 1),
  });
  const plain = (title: string, sub?: string | null) =>
    h(
      "div",
      { className: "sl-voice", title: st.error || undefined },
      h("div", { className: "sl-dot" }),
      h("div", { className: "vm" }, h("div", { className: "vt" }, title), sub ? h("div", { className: "vs" }, sub) : null),
      refresh,
    );

  if (st.error && !v) return plain("Онлайн не загрузился", st.error.split("\n")[0]);
  if (!v)
    return plain(
      st.loading && !st.at ? "Проверяю, где сейчас…" : "Нет данных о голосовых каналах",
      st.at ? `проверено ${relTime(st.at)}` : null,
    );

  const sitting = v.live && v.sessionSec != null ? fmtDur(v.sessionSec + (Date.now() - st.at) / 1000) : null;
  const flags = v.live
    ? [v.flags.mute && "🎙️ выкл", v.flags.deaf && "🎧 выкл", v.flags.stream && "📺 стрим", v.flags.video && "📷 камера"].filter(Boolean)
    : [];
  const fromInfo = info.data && parseVoice(info.data);
  const mates = !v.live ? [] : v.others.length ? v.others : fromInfo?.channelId === v.channelId ? fromInfo.others : [];

  return h(
    "div",
    { className: "sl-voice " + (v.live ? "on" : "last") },
    h(Avatar, { className: "gi", src: v.icon, name: v.guild || "?", seed: v.guildId }),
    h(
      "div",
      { className: "vm" },
      h(
        "div",
        { className: "vt" },
        h("span", { className: v.live ? "sl-live" : "sl-lastb" }, v.live ? "LIVE" : "БЫЛ"),
        h("span", { className: "vch" }, "🔊 " + (v.channel || "голосовой канал")),
      ),
      h(
        "div",
        { className: "vs" },
        h("span", null, [v.guild, v.category].filter(Boolean).join(" · ")),
        v.live
          ? sitting
            ? h("span", null, `сидит ${sitting}`)
            : null
          : v.lastTime
            ? h("span", { title: fmtDate(v.lastTime) }, `вышел ${relTime(v.lastTime)}`)
            : null,
        flags.map((t) => h("span", { key: t }, t)),
      ),
    ),
    mates.length
      ? h(
          "div",
          { className: "sl-mates" },
          mates.slice(0, 5).map((m: any) =>
            h(Avatar, {
              key: m.user_id,
              className: "sl-mate",
              src: userAvatar(m.user_id, m.avatar, 32),
              name: m.display_name || m.username,
              seed: m.user_id,
              title: `${m.display_name || m.username} (@${m.username})${m.self_mute ? " · 🎙️ выкл" : ""}${m.self_deaf ? " · 🎧 выкл" : ""}`,
            }),
          ),
          mates.length > 5 ? h("span", { className: "sl-mate more" }, `+${mates.length - 5}`) : null,
        )
      : null,
    v.guildId && v.channelId
      ? h(IconBtn, { icon: "ext", size: 16, title: "Перейти в канал", onClick: () => goChannel(v.guildId!, v.channelId!) })
      : null,
    refresh,
  );
}
