import { h, useState } from "../core";
import { api } from "../api";
import { num, fmtNum, fmtDur, fmtHours, fmtDate, relTime, guildIcon } from "../format";
import { useLoad, State, Empty, Avatar, Pager, Seg, Search, match, delay } from "./common";

const NICK_TYPE: Record<string, string> = {
  server_nick: "ник на сервере",
  global_name: "отображаемое имя",
  username: "юзернейм",
  display_name: "отображаемое имя",
};

export function NicknamesTab({ uid }: { uid: string }) {
  const [page, setPage] = useState(0);
  const [guild, setGuild] = useState("");
  const st = useLoad((f: boolean) => api.nicknames(uid, page, f), [uid, page]);
  return State(
    {
      st,
      left: (d: any) => {
        if (page > 0 || d?.hasNextPage) return null;
        const gs = [
          ...new Map(
            (d?.nicknames || []).filter((n: any) => n.guild).map((n: any): [string, string] => [n.guild.id, n.guild.name]),
          ).entries(),
        ];
        return gs.length > 1
          ? h(
              "select",
              { className: "sl-select", value: guild, onChange: (e) => setGuild(e.target.value) },
              h("option", { value: "" }, "все серверы"),
              gs.map(([id, name]) => h("option", { key: id, value: id }, name)),
            )
          : null;
      },
    },
    (d: any) => {
      const all = Array.isArray(d?.nicknames) ? d.nicknames : [];
      if (!all.length && page === 0) return h(Empty, { icon: "🏷️", text: "История ников пуста." });
      const single = page === 0 && !d?.hasNextPage;
      const list = single && guild ? all.filter((n: any) => n.guild?.id === guild) : all;
      return h(
        "div",
        null,
        h(
          "div",
          { className: "sl-tl" },
          list.map((n: any, i: number) => {
            const g = n.guild;
            return h(
              "div",
              {
                key: n.id || i,
                className: "sl-tli" + (i === 0 && page === 0 && !(single && guild) ? " first" : "") + (n.is_hidden ? " faded" : ""),
                style: delay(i),
              },
              h(
                "div",
                { className: "sl-tli-row" },
                h(
                  "div",
                  { className: "sl-main" },
                  h("div", { className: "sl-title" }, n.nickname || "—"),
                  h(
                    "div",
                    { className: "sl-sub" },
                    h("span", null, `${fmtDate(n.time)} · ${relTime(n.time)}`),
                    h("span", null, NICK_TYPE[n.type] || n.type),
                  ),
                ),
                g
                  ? h(
                      "div",
                      { className: "sl-nick-g", title: g.vanity_url ? `discord.gg/${g.vanity_url}` : g.id },
                      h(Avatar, { className: "sl-gi xs", src: guildIcon(g.id, g.avatar_hash, 32), name: g.name, seed: g.id }),
                      h("span", null, g.name),
                    )
                  : null,
              ),
            );
          }),
        ),
        h(Pager, { page, setPage, hasNext: !!d?.hasNextPage }),
      );
    },
  );
}

const SORTS: Record<string, (a: any, b: any) => number> = {
  voice: (a, b) => (num(b.voice_seconds) || 0) - (num(a.voice_seconds) || 0) || (num(b.messages) || 0) - (num(a.messages) || 0),
  messages: (a, b) => (num(b.messages) || 0) - (num(a.messages) || 0),
  members: (a, b) => (num(b.member_count) || 0) - (num(a.member_count) || 0),
  name: (a, b) => String(a.name).localeCompare(String(b.name), "ru"),
};

export function GuildsTab({ uid }: { uid: string }) {
  const st = useLoad((f: boolean) => api.guilds(uid, f), [uid]);
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("voice");
  const [q, setQ] = useState("");
  return State(
    {
      st,
      left: (d: any) => {
        const all = d?.guild_list || [];
        const left = all.filter((g: any) => g.left).length;
        return [
          h(Search, { key: "s", value: q, onChange: setQ, placeholder: "поиск" }),
          h(Seg, {
            key: "f",
            value: scope,
            onChange: setScope,
            options: [
              ["all", `все ${all.length}`],
              ["in", `там ${all.length - left}`],
            ],
          }),
          h(
            "select",
            { key: "o", className: "sl-select", value: sort, onChange: (e) => setSort(e.target.value) },
            h("option", { value: "voice" }, "по войсу"),
            h("option", { value: "messages" }, "по сообщениям"),
            h("option", { value: "members" }, "по участникам"),
            h("option", { value: "name" }, "по названию"),
          ),
        ];
      },
    },
    (d: any) => {
      const all = Array.isArray(d?.guild_list) ? d.guild_list : [];
      if (!all.length) return h(Empty, { icon: "🏰", text: "Серверов не найдено." });
      const list = all.filter((g: any) => (scope === "all" || !g.left) && match(q, g.name, g.id)).sort(SORTS[sort]);
      if (!list.length) return h(Empty, { icon: "🔎", text: "Ничего не подходит под фильтр." });
      return h(
        "div",
        { className: "sl-guilds" },
        list.map((g: any, i: number) =>
          h(
            "div",
            { key: g.id, className: "sl-guild" + (g.left ? " left" : ""), style: delay(i), title: `ID: ${g.id}` },
            g.left ? h("span", { className: "sl-left" }, "вышел") : null,
            h(Avatar, { src: guildIcon(g.id, g.icon, 96), name: g.name, seed: g.id }),
            h("div", { className: "n" }, g.name || "Без названия"),
            h(
              "div",
              { className: "m" },
              `👥 ${fmtNum(g.member_count)}`,
              num(g.voice_member_count) ? ` · 🔊 ${fmtNum(g.voice_member_count)}` : "",
            ),
            h(
              "div",
              { className: "m" },
              `💬 ${fmtNum(g.messages || 0)} · `,
              h("span", { title: fmtHours(g.voice_seconds) || "в войсе не был" }, `🎙 ${fmtDur(g.voice_seconds)}`),
            ),
          ),
        ),
      );
    },
  );
}
