import { h, useState, useEffect, useRef, BASE, copy, loadSettings, patchSettings, type Node } from "../core";
import { api } from "../api";
import { hue, userAvatar, tagBadge } from "../format";
import { loadBlob } from "../media";
import { useLoad, Avatar, Icon, IconBtn, Chip, type IconName } from "./common";
import { InfoTab } from "./info";
import { FriendsTab, type Target } from "./friends";
import { NicknamesTab, GuildsTab } from "./lists";
import { MediaTab } from "./media";
import { VoiceNow } from "./voice";
import { guard } from "./boundary";

const TABS: [string, string, IconName][] = [
  ["info", "Инфо", "info"],
  ["friends", "Друзья", "friends"],
  ["nicknames", "Ники", "nick"],
  ["guilds", "Серверы", "guilds"],
  ["media", "Медиа", "media"],
];

function Wallpaper({ url, referer }: { url: string; referer: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadBlob(url, referer).then(
      (u) => alive && setSrc(u),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? h("div", { className: "sl-wall", style: { backgroundImage: `url("${src}")` } }) : null;
}

const FOCUSABLE = "button:not([disabled]),input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])";

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== "Tab" || !root) return;
  const els = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!els.length) return;
  const first = els[0];
  const last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  } else if (!root.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  }
}

export function Lookup({ initial, onClose }: { initial: Target; onClose: () => void }) {
  const [stack, setStack] = useState<Target[]>([initial]);
  const [tab, setTabState] = useState(() => (TABS.some(([k]) => k === loadSettings().lastTab) ? loadSettings().lastTab : "info"));
  const card = useRef<HTMLElement | null>(null);
  const cur = stack[stack.length - 1];
  const info = useLoad((f: boolean) => api.info(cur.id, f), [cur.id]);
  const u = info.data && typeof info.data === "object" ? info.data : null;

  const setTab = (k: string) => {
    setTabState(k);
    patchSettings({ lastTab: k });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector(".sl-lb")) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else trapFocus(e, card.current);
    };
    window.addEventListener("keydown", onKey, true);
    card.current?.querySelector<HTMLElement>(".sl-tab.on")?.focus();
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const hh = hue(cur.id);
  const name = u?.display_name || u?.actual_name || cur.name || cur.id;
  const handle = u?.actual_name || cur.handle;
  const badge = u && tagBadge(u.tag_guild, u.badge_hash);
  const open = (x: Target) => {
    setStack([...stack, x]);
    setTabState("info");
  };

  const body = (
    {
      info: () => h(InfoTab, { st: info, uid: cur.id }),
      friends: () => h(FriendsTab, { uid: cur.id, onOpen: open }),
      nicknames: () => h(NicknamesTab, { uid: cur.id }),
      guilds: () => h(GuildsTab, { uid: cur.id }),
      media: () => h(MediaTab, { uid: cur.id }),
    } as Record<string, () => Node>
  )[tab];

  return h(
    "div",
    { className: "sl-overlay", onMouseDown: (e) => e.target === e.currentTarget && onClose() },
    h(
      "div",
      {
        ref: card,
        className: "sl-card",
        role: "dialog",
        "aria-modal": true,
        "aria-label": `Discord Sensor: ${name}`,
        style: {
          "--sl-accent": `hsl(${hh},70%,58%)`,
          "--sl-accent2": `hsl(${(hh + 40) % 360},75%,62%)`,
          "--sl-accent-a": `hsla(${hh},70%,58%,.35)`,
        },
      },
      h(
        "div",
        { className: "sl-banner", style: { background: `linear-gradient(135deg,hsl(${hh},65%,45%),hsl(${(hh + 50) % 360},70%,35%))` } },
        u?.profile_wallpaper_url ? h(Wallpaper, { url: BASE + u.profile_wallpaper_url, referer: `/members/${cur.id}` }) : null,
        u?.customization?.banner_text ? h("div", { className: "sl-bntext" }, u.customization.banner_text) : null,
        h(
          "div",
          { className: "sl-topbtns" },
          stack.length > 1 ? h(IconBtn, { icon: "back", title: "Назад", onClick: () => setStack(stack.slice(0, -1)) }) : null,
          h("div", { className: "sp" }),
          h(IconBtn, { icon: "ext", title: "Открыть на сайте", onClick: () => window.open(`${BASE}/members/${cur.id}`, "_blank") }),
          h(IconBtn, { icon: "close", title: "Закрыть (Esc)", onClick: onClose }),
        ),
      ),
      h(
        "div",
        { className: "sl-head" },
        h(Avatar, { className: "sl-ava", src: cur.avatar || (u && userAvatar(cur.id, u.actual_avatar, 128)), name, seed: cur.id }),
        h(
          "div",
          { className: "sl-who" },
          h("div", { className: "sl-name" }, name),
          h(
            "div",
            { className: "sl-handle" },
            handle ? h("span", null, "@" + handle) : null,
            u?.tag ? Chip({ className: "tag", title: "Тег сервера" }, badge ? h("img", { src: badge, alt: "" }) : null, u.tag) : null,
            Chip({ title: "Скопировать ID", onClick: () => copy(cur.id, "ID") }, h(Icon, { name: "copy", size: 12 }), cur.id),
            stack.length > 1 ? Chip({}, `шаг ${stack.length}`) : null,
          ),
        ),
      ),
      h("div", { key: "v" + cur.id }, guard("Где сейчас", h(VoiceNow, { uid: cur.id, info }))),
      h(
        "div",
        { className: "sl-tabs", role: "tablist" },
        TABS.map(([k, label, icon]) =>
          h(
            "button",
            { key: k, role: "tab", "aria-selected": tab === k, className: "sl-tab" + (tab === k ? " on" : ""), onClick: () => setTab(k) },
            h(Icon, { name: icon, size: 16 }),
            label,
          ),
        ),
      ),
      h(
        "div",
        { className: "sl-body", key: cur.id + tab, role: "tabpanel" },
        guard(TABS.find(([k]) => k === tab)?.[1] || "Вкладка", body()),
      ),
    ),
  );
}
