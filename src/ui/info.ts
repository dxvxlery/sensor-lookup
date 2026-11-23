import { h, useState, type Node } from "../core";
import { api } from "../api";
import { fmtNum, fmtDur, fmtHours, fmtDate, relTime, guildIcon, roleIcon, userAvatar } from "../format";
import { threadComments, type Thread } from "../parse";
import { guard } from "./boundary";
import { useLoad, State, Empty, Avatar, Pager, Stat, delay, type LoadState } from "./common";

const KINDS = [
  ["admin_roles", "Админ", "#f23f43"],
  ["mod_roles", "Модератор", "#f57731"],
  ["staff_roles", "Стафф", "#5865f2"],
  ["ban_roles", "Бан", "#80848e"],
];
const GENDER: Record<string, string> = { female: "♀ женский", male: "♂ мужской" };
const NITRO = ["", "Nitro Classic", "Nitro", "Nitro Basic"];

function Role({ r, color }: { r: any; color: string }) {
  const icon = roleIcon(r.id, r.icon_hash);
  return h(
    "span",
    { className: "sl-role", style: { "--rc": color }, title: `ID роли: ${r.id}` },
    icon ? h("img", { src: icon, alt: "" }) : r.unicode_emoji ? h("span", null, r.unicode_emoji) : h("i"),
    r.name || "роль",
  );
}

function GuildRoles({ g, owner, i }: { g: any; owner?: boolean; i: number }) {
  return h(
    "div",
    { className: "sl-rg", style: delay(i) },
    h(
      "div",
      { className: "sl-rg-h" },
      h(Avatar, { className: "sl-gi", src: guildIcon(g.id, g.icon_hash || g.icon), name: g.name, seed: g.id }),
      h(
        "div",
        { className: "sl-main" },
        h("div", { className: "sl-title" }, g.name || g.id),
        g.member_count ? h("div", { className: "sl-sub" }, `👥 ${fmtNum(g.member_count)} участников`) : null,
      ),
    ),
    h(
      "div",
      { className: "sl-rg-roles" },
      owner
        ? h("span", { className: "sl-role", style: { "--rc": "#f0b232" } }, h("span", null, "👑"), "Владелец сервера")
        : KINDS.flatMap(([key, label, color]): Node[] => {
            const roles = Array.isArray(g[key]) ? g[key] : [];
            return roles.length
              ? [
                  h("span", { key, className: "sl-role-kind", style: { color } }, label),
                  ...roles.map((r: any) => h(Role, { key: key + r.id, r, color })),
                ]
              : [];
          }),
    ),
  );
}

const RichText = ({ text }: { text?: string }) =>
  h(
    "div",
    { className: "sl-cm-text" },
    String(text || "")
      .split(/(https?:\/\/[^\s<>"']+)/g)
      .map((p, i) =>
        /^https?:\/\//.test(p)
          ? h(
              "a",
              {
                key: i,
                href: p,
                onClick: (e) => {
                  e.preventDefault();
                  window.open(p, "_blank");
                },
              },
              p,
            )
          : p,
      ),
  );

function Comment({ n, uid, depth = 0 }: { n: Thread; uid: string; depth?: number }): Node {
  const { c, replies } = n;
  const a = c.author_info;
  const anon = c.is_anonymous || c.is_anon_comment || !a;
  const rgb = Array.isArray(c.anon_color) ? `rgb(${c.anon_color.join(",")})` : null;
  const name = anon ? "Аноним" : a.display_name || a.username;
  return h(
    "div",
    { className: "sl-cm" + (depth ? " reply" : "") + (c.pinned ? " pinned" : "") },
    anon
      ? h("div", { className: "sl-av sm ph", style: { background: rgb || "#4e5058" } }, "?")
      : h(Avatar, { className: "sl-av sm", src: userAvatar(a.discord_id, a.avatar), name, seed: a.discord_id }),
    h(
      "div",
      { className: "sl-main" },
      h(
        "div",
        { className: "sl-cm-h" },
        h("span", { className: "sl-cm-name", style: anon && rgb ? { color: rgb } : null }, name),
        !anon && a.username && a.username !== name ? h("span", { className: "sl-cm-sm" }, "@" + a.username) : null,
        !anon && a.discord_id === uid ? h("span", { className: "sl-tag" }, "сам о себе") : null,
        c.pinned ? h("span", { className: "sl-tag pin" }, "📌 закреплён") : null,
        h("span", { className: "sl-cm-sm", title: fmtDate(c.date) }, relTime(c.date) || fmtDate(c.date)),
        c.is_edited ? h("span", { className: "sl-cm-sm" }, "· изменён") : null,
      ),
      c.deleted ? h("div", { className: "sl-cm-text del" }, "комментарий удалён") : h(RichText, { text: c.content }),
      c.like_count || c.attachments?.length
        ? h(
            "div",
            { className: "sl-cm-f" },
            c.like_count ? h("span", null, `♥ ${fmtNum(c.like_count)}`) : null,
            c.attachments?.length ? h("span", null, `📎 ${c.attachments.length}`) : null,
          )
        : null,
      replies.length
        ? h(
            "div",
            { className: "sl-cm-replies" },
            replies.map((r: Thread) => h(Comment, { key: r.c.comment_id, n: r, uid, depth: depth + 1 })),
          )
        : null,
    ),
  );
}

function Comments({ uid }: { uid: string }) {
  const [page, setPage] = useState(0);
  const st = useLoad((f: boolean) => api.comments(uid, page, f), [uid, page]);
  const total = st.data?.paginator?.total_count ?? st.data?.item_count;
  return h(
    "div",
    null,
    h("div", { className: "sl-sect" }, `Комментарии${total != null ? ` · ${fmtNum(total)}` : ""}`),
    State({ st }, (d: any) => {
      const list = Array.isArray(d?.comments_list) ? d.comments_list : [];
      if (!list.length) return h(Empty, { icon: "💬", text: "О пользователе ещё никто не писал." });
      return h(
        "div",
        null,
        threadComments(list).map((n: Thread) => h(Comment, { key: n.c.comment_id, n, uid })),
        h(Pager, { page, setPage, hasNext: !!d.paginator?.has_next }),
      );
    }),
  );
}

export function InfoTab({ st, uid }: { st: LoadState; uid: string }) {
  return State({ st }, (u: any) => {
    if (!u || typeof u !== "object") return h(Empty, { icon: "🕵️", text: "Сайт ничего не знает об этом пользователе." });
    const tiles = [
      ["Время в войсе", fmtDur(u.time_in_voice), fmtHours(u.time_in_voice) && `всего ${fmtHours(u.time_in_voice)}`],
      ["Последний раз в войсе", fmtDate(u.last_date_in_voice), relTime(u.last_date_in_voice)],
      ["Сообщений", fmtNum(u.total_messages)],
      ["Репутация", fmtNum(u.reputation)],
      ["Просмотров профиля", fmtNum(u.views)],
      u.gender && ["Пол", GENDER[u.gender] || u.gender],
      u.premium_tier && ["Nitro", NITRO[u.premium_tier] || `уровень ${u.premium_tier}`],
    ].filter(Boolean);
    const owner = u.owner_guilds || [];
    const roles = u.role_guilds || [];
    return h(
      "div",
      null,
      h(
        "div",
        { className: "sl-grid" },
        tiles.map(([k, v, sub], i) => h(Stat, { key: k, k, v, sub, i })),
      ),
      owner.length
        ? [
            h("div", { key: "oh", className: "sl-sect" }, `Владеет серверами · ${owner.length}`),
            ...owner.map((g: any, i: number) => h(GuildRoles, { key: "o" + g.id, g, owner: true, i })),
          ]
        : null,
      roles.length
        ? [
            h("div", { key: "rh", className: "sl-sect" }, `Роли на серверах · ${roles.length}`),
            ...roles.map((g: any, i: number) => h(GuildRoles, { key: g.id, g, i })),
          ]
        : null,
      guard("Комментарии", h(Comments, { uid })),
    );
  });
}
