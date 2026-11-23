import { h, useState, useEffect, goChannel } from "../core";
import { api } from "../api";
import { num, fmtDur, fmtHours, fmtDate, fmtTime, relTime, toDate, guildIcon, userAvatar } from "../format";
import { useLoad, State, Empty, Avatar, Pager, Icon, IconBtn, Seg, SortSelect, Skeleton, delay } from "./common";
import { guard } from "./boundary";
import type { Target } from "./friends";

const VOICE_SORTS: Record<string, [string, string, string]> = {
  new: ["timestamp", "desc", "сначала новые"],
  old: ["timestamp", "asc", "сначала старые"],
  long: ["duration", "desc", "самые долгие"],
  short: ["duration", "asc", "самые короткие"],
};

const SERVER_SORTS: Record<string, [string, string, string]> = {
  new: ["timestamp", "desc", "сначала новые"],
  old: ["timestamp", "asc", "сначала старые"],
};

const SERVER_TYPES = [
  ["", "все"],
  ["join", "вход"],
  ["leave", "выход"],
];

function range(fromV: unknown, untilV: unknown) {
  const from = toDate(fromV);
  const until = toDate(untilV);
  if (!from) return "—";
  if (!until) return `${fmtDate(from)} – сейчас`;
  return `${fmtDate(from)} – ${from.toDateString() === until.toDateString() ? fmtTime(until) : fmtDate(until)}`;
}

function VoiceMembers({ uid, event, onOpen }: { uid: string; event: any; onOpen: (t: Target) => void }) {
  const st = useLoad((f: boolean) => api.voiceMembers(uid, event.id, f), [event.id]);
  const total = num(event.voice_duration) || 1;
  return h(
    "div",
    { className: "sl-ss" },
    h("div", { className: "sl-ss-h" }, h("b", null, "Кто был в канале")),
    State({ st, skeleton: h(Skeleton, { n: 3, className: "sl-skel sm" }) }, (d: any) => {
      const list: any[] = (Array.isArray(d) ? d : d?.results || d?.members || []).filter((m: any) => String(m.user_id) !== uid);
      if (!list.length) return h(Empty, { icon: "🎧", text: "Сидел в канале один." });
      return h(
        "div",
        null,
        list.map((m, i) => {
          const sec = num(m.total_overlap) || 0;
          const id = String(m.user_id);
          return h(
            "div",
            {
              key: id,
              className: "sl-ses click",
              style: delay(i),
              title: "Открыть профиль",
              onClick: () => onOpen({ id, name: m.username, handle: m.username, avatar: userAvatar(id, m.avatar, 128) }),
            },
            h(Avatar, { className: "sl-av sm", src: userAvatar(id, m.avatar), name: m.username, seed: id }),
            h(
              "div",
              { className: "sl-main" },
              h("div", { className: "sl-title" }, m.username || id),
              h("div", { className: "sl-bar" }, h("i", { style: { width: Math.max(3, Math.min(100, (sec / total) * 100)) + "%" } })),
            ),
            h("div", { className: "sl-val", title: fmtHours(sec) }, fmtDur(sec)),
          );
        }),
      );
    }),
  );
}

function VoiceEvents({ uid, onOpen }: { uid: string; onOpen: (t: Target) => void }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("new");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setOpen(null), [page, sort]);
  const [by, order] = VOICE_SORTS[sort];
  const st = useLoad((f: boolean) => api.events(uid, "voice_history", page, by, order, "", f), [uid, page, sort]);
  return State(
    {
      st,
      left: h(SortSelect, {
        value: sort,
        options: VOICE_SORTS,
        onChange: (v: string) => {
          setSort(v);
          setPage(0);
        },
      }),
      skeleton: h(Skeleton, { n: 6, className: "sl-skel sm" }),
    },
    (d: any) => {
      const list: any[] = Array.isArray(d?.results) ? d.results : [];
      if (!list.length && page === 0) return h(Empty, { icon: "🔇", text: "Голосовых событий нет." });
      const max = Math.max(1, ...list.map((e) => num(e.voice_duration) || 0));
      return h(
        "div",
        null,
        list.map((e, i) => {
          const sec = num(e.voice_duration) || 0;
          const key = String(e.id ?? i);
          const isOpen = open === key;
          return h(
            "div",
            { key, className: "sl-fr" + (isOpen ? " open" : ""), style: delay(i) },
            h(
              "div",
              { className: "sl-ses click", title: "Кто был в канале", onClick: () => setOpen(isOpen ? null : key) },
              h(Avatar, {
                className: "sl-gi",
                src: guildIcon(e.guild_id, e.guild_avatar),
                name: e.guild_name,
                seed: e.guild_id,
                title: e.guild_name,
              }),
              h(
                "div",
                { className: "sl-main" },
                h("div", { className: "sl-title" }, "🔊 " + (e.channel_name || "канал")),
                h(
                  "div",
                  { className: "sl-sub" },
                  h("span", null, e.guild_name || ""),
                  h("span", { title: relTime(e.join_timestamp) }, range(e.join_timestamp, e.leave_timestamp)),
                ),
                h("div", { className: "sl-bar" }, h("i", { style: { width: Math.max(3, (sec / max) * 100) + "%" } })),
              ),
              h("div", { className: "sl-val", title: fmtHours(sec) }, fmtDur(sec)),
              e.guild_id && e.channel_id
                ? h(IconBtn, {
                    icon: "ext",
                    size: 14,
                    className: "sl-sm",
                    title: "Перейти в канал",
                    onClick: (ev: any) => {
                      ev.stopPropagation();
                      goChannel(e.guild_id, e.channel_id);
                    },
                  })
                : null,
              e.id != null ? h("div", { className: "sl-go sl-exp" }, h(Icon, { name: "chev", size: 16 })) : null,
            ),
            isOpen && e.id != null ? guard("Кто был в канале", h(VoiceMembers, { uid, event: e, onOpen })) : null,
          );
        }),
        h(Pager, { page, setPage, hasNext: !!d?.has_next }),
      );
    },
  );
}

function ServerEvents({ uid }: { uid: string }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("new");
  const [type, setType] = useState("");
  const [by, order] = SERVER_SORTS[sort];
  const st = useLoad((f: boolean) => api.events(uid, "server_history", page, by, order, type, f), [uid, page, sort, type]);
  return State(
    {
      st,
      left: [
        h(Seg, {
          key: "t",
          value: type,
          options: SERVER_TYPES,
          onChange: (v: string) => {
            setType(v);
            setPage(0);
          },
        }),
        h(SortSelect, {
          key: "s",
          value: sort,
          options: SERVER_SORTS,
          onChange: (v: string) => {
            setSort(v);
            setPage(0);
          },
        }),
      ],
      skeleton: h(Skeleton, { n: 6, className: "sl-skel sm" }),
    },
    (d: any) => {
      const list: any[] = Array.isArray(d?.results) ? d.results : [];
      if (!list.length && page === 0) return h(Empty, { icon: "🚪", text: type ? "Таких событий нет." : "Входов и выходов не найдено." });
      return h(
        "div",
        null,
        list.map((e, i) => {
          const joined = e.type === true || e.type === "join";
          return h(
            "div",
            { key: e.id || i, className: "sl-ses" + (e.is_hidden ? " faded" : ""), style: delay(i) },
            h(Avatar, {
              className: "sl-gi",
              src: guildIcon(e.guild_id, e.guild_avatar),
              name: e.guild_name,
              seed: e.guild_id,
              title: e.guild_id,
            }),
            h(
              "div",
              { className: "sl-main" },
              h("div", { className: "sl-title" }, e.guild_name || e.guild_id || "сервер"),
              h(
                "div",
                { className: "sl-sub" },
                h("span", { title: relTime(e.timestamp) }, `${fmtDate(e.timestamp)} · ${relTime(e.timestamp)}`),
              ),
            ),
            h("span", { className: "sl-ev " + (joined ? "is-join" : "is-leave") }, joined ? "зашёл" : "вышел"),
          );
        }),
        h(Pager, { page, setPage, hasNext: !!d?.has_next }),
      );
    },
  );
}

export function EventsTab({ uid, onOpen }: { uid: string; onOpen: (t: Target) => void }) {
  const [sub, setSub] = useState("voice");
  return h(
    "div",
    null,
    h(Seg, {
      className: "sl-subtabs",
      value: sub,
      onChange: setSub,
      options: [
        ["voice", "Голосовые"],
        ["servers", "Серверы"],
      ],
    }),
    sub === "voice" ? h(VoiceEvents, { key: "v", uid, onOpen }) : h(ServerEvents, { key: "s", uid }),
  );
}
