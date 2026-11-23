import { h, useState, useEffect, goChannel, type Node } from "../core";
import { api } from "../api";
import { num, fmtNum, fmtDur, fmtHours, fmtDate, fmtDay, fmtTime, relTime, toDate, userAvatar, guildIcon } from "../format";
import { sessionSummary } from "../parse";
import { guard } from "./boundary";
import { useLoad, State, Empty, Avatar, Pager, Icon, IconBtn, Seg, Skeleton, SortSelect, delay } from "./common";

const Bar = ({ v, max }: { v: number; max: number }) =>
  h("div", { className: "sl-bar" }, h("i", { style: { width: Math.max(3, (v / max) * 100) + "%" } }));

function Session({ s, max, i }: { s: any; max: number; i: number }) {
  const g = s.guild || {};
  const ch = s.channel || {};
  const from = toDate(s.together_from);
  const until = toDate(s.together_until);
  const range = from
    ? `${fmtDate(from)} – ${until ? (from.toDateString() === until.toDateString() ? fmtTime(until) : fmtDate(until)) : "…"}`
    : "—";
  const sec = num(s.overlap_seconds) || 0;
  return h(
    "div",
    { className: "sl-ses", style: delay(i) },
    h(Avatar, { className: "sl-gi", src: guildIcon(g.id, g.icon_hash), name: g.name, seed: g.id, title: g.name }),
    h(
      "div",
      { className: "sl-main" },
      h("div", { className: "sl-title" }, "🔊 " + (ch.name || "канал")),
      h("div", { className: "sl-sub" }, h("span", null, g.name || ""), h("span", { title: relTime(from) }, range)),
      h(Bar, { v: sec, max }),
    ),
    h("div", { className: "sl-val", title: fmtHours(sec) }, fmtDur(sec)),
    g.id && ch.id
      ? h(IconBtn, { icon: "ext", size: 14, className: "sl-sm", title: "Перейти в канал", onClick: () => goChannel(g.id, ch.id) })
      : null,
  );
}

function Sessions({ uid, peer, peerName }: { uid: string; peer: string; peerName?: string }) {
  const [sort, setSort] = useState("time");
  const [page, setPage] = useState(0);
  const st = useLoad((f: boolean) => api.sessions(uid, peer, sort, page, f), [uid, peer, sort, page]);
  return h(
    "div",
    { className: "sl-ss" },
    h(
      "div",
      { className: "sl-ss-h" },
      h("b", null, "Совместные голосовые"),
      h(Seg, {
        value: sort,
        onChange: (v) => {
          setSort(v);
          setPage(0);
        },
        options: [
          ["time", "По времени"],
          ["duration", "По длительности"],
        ],
      }),
    ),
    State(
      {
        st,
        left: (d: any) => (d?.since ? h("span", { className: "sl-count", title: fmtDate(d.since) }, `данные с ${fmtDay(d.since)}`) : null),
        skeleton: h(Skeleton, { n: 3, className: "sl-skel sm" }),
      },
      (d: any) => {
        const list = Array.isArray(d?.sessions) ? d.sessions : [];
        if (!list.length && page === 0) return h(Empty, { icon: "🔇", text: `Вместе с ${peerName || "другом"} в голосовых не сидели.` });
        const max = Math.max(1, ...list.map((s: any) => num(s.overlap_seconds) || 0));
        const sum = sessionSummary(list);
        const hasMore = page > 0 || !!d?.hasNextPage;
        const rows: Node[] = [];
        let day: string | null = null;
        list.forEach((s: any, i: number) => {
          const dd = sort === "time" ? fmtDay(s.together_from) : null;
          if (dd && dd !== day) rows.push(h("div", { key: "d" + i, className: "sl-day" }, (day = dd)));
          rows.push(h(Session, { key: i, s, max, i }));
        });
        return h(
          "div",
          null,
          h(
            "div",
            { className: "sl-sum" },
            h("em", null, hasMore ? "на этой странице" : "всего"),
            h("span", null, "сессий ", h("b", null, sum.count)),
            h("span", { title: fmtHours(sum.total) }, "вместе ", h("b", null, fmtDur(sum.total))),
            sum.top ? h("span", { title: `${sum.top.name} — ${fmtDur(sum.top.sec)}` }, "чаще всего ", h("b", null, sum.top.name)) : null,
          ),
          rows,
          h(Pager, { page, setPage, hasNext: !!d?.hasNextPage }),
        );
      },
    ),
  );
}

export interface Target {
  id: string;
  name?: string;
  handle?: string;
  avatar?: string | null;
}

const FRIEND_SORTS: Record<string, [string, string, string]> = {
  most: ["duration", "desc", "больше всего вместе"],
  least: ["duration", "asc", "меньше всего вместе"],
  recent: ["last", "desc", "недавно вместе"],
  oldest: ["last", "asc", "давно вместе"],
};

export function FriendsTab({ uid, onOpen }: { uid: string; onOpen: (t: Target) => void }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("most");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setOpen(null), [page, sort]);
  const [by, order] = FRIEND_SORTS[sort];
  const st = useLoad((f: boolean) => api.friends(uid, page, by, order, f), [uid, page, sort]);
  return State(
    {
      st,
      left: (d: any) => [
        h(SortSelect, {
          key: "s",
          value: sort,
          options: FRIEND_SORTS,
          onChange: (v: string) => {
            setSort(v);
            setPage(0);
          },
        }),
        d?.friends?.totalFriends != null ? h("span", { key: "c", className: "sl-count" }, `всего ${fmtNum(d.friends.totalFriends)}`) : null,
      ],
    },
    (d: any) => {
      const fr = d?.friends || {};
      const all = Array.isArray(fr.records) ? fr.records : [];
      if (!all.length && page === 0) return h(Empty, { icon: "🤝", text: "Совместных звонков не найдено." });
      const per = 30;
      const total = num(fr.totalPages);
      const max = Math.max(1, ...all.map((x: any) => num(x.friends_online_duration) || 0));
      const list = all.map((x: any, i: number): [any, number] => [x, page * per + i + 1]);
      return h(
        "div",
        null,
        list.map(([x, rank]: [any, number], i: number) => {
          const id = String(x.friendId);
          const sec = num(x.friends_online_duration) || 0;
          const hidden = Object.keys(x).some((k) => k.startsWith("hidden_by_") && x[k] === true);
          const isOpen = open === id;
          return h(
            "div",
            { key: id, className: "sl-fr" + (isOpen ? " open" : ""), style: delay(i) },
            h(
              "div",
              {
                className: "sl-row click" + (hidden ? " faded" : ""),
                title: "Совместные голосовые каналы",
                onClick: () => setOpen(isOpen ? null : id),
              },
              h(
                "div",
                { className: "sl-rank" + (sort === "most" && rank <= 3 ? " top" : "") },
                (sort === "most" && ["🥇", "🥈", "🥉"][rank - 1]) || rank,
              ),
              h(Avatar, { className: "sl-av", src: userAvatar(id, x.avatar), name: x.username, seed: id }),
              h(
                "div",
                { className: "sl-main" },
                h("div", { className: "sl-title" }, x.username || id, hidden ? h("span", { className: "sl-tag" }, "скрыт") : null),
                x.last_friends_online
                  ? h(
                      "div",
                      { className: "sl-sub" },
                      h("span", { title: fmtDate(x.last_friends_online) }, `вместе ${relTime(x.last_friends_online)}`),
                    )
                  : null,
                h(Bar, { v: sec, max }),
              ),
              h("div", { className: "sl-val", title: fmtHours(sec) }, fmtDur(sec)),
              h(IconBtn, {
                icon: "user",
                size: 15,
                className: "sl-sm",
                title: "Открыть профиль",
                onClick: (e) => {
                  e.stopPropagation();
                  onOpen({ id, name: x.username, handle: x.username, avatar: userAvatar(id, x.avatar, 128) });
                },
              }),
              h("div", { className: "sl-go sl-exp" }, h(Icon, { name: "chev", size: 16 })),
            ),
            isOpen ? guard("Совместные голосовые", h(Sessions, { uid, peer: id, peerName: x.username })) : null,
          );
        }),
        h(Pager, { page, setPage, total, hasNext: total ? page + 1 < total : all.length >= per }),
      );
    },
  );
}
