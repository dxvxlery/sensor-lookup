import { h, useState, useEffect } from "../core";
import { api } from "../api";
import { MEDIA_TYPES, mediaUrl, loadBlob } from "../media";
import { guard } from "./boundary";
import { useLoad, State, Empty, Pager, Icon, IconBtn, Seg, Chip, delay } from "./common";

export function BlobImg({
  url,
  referer,
  className = "",
  onReady,
}: {
  url: string;
  referer?: string;
  className?: string;
  onReady?: (u: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setErr(null);
    loadBlob(url, referer).then(
      (u) => {
        if (alive) {
          setSrc(u);
          onReady?.(u);
        }
      },
      (e: any) => alive && setErr(e?.message || "ошибка"),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  if (err) return h("div", { className: className + " sl-imgerr", title: err }, "⚠️");
  if (!src) return h("div", { className: className + " sl-imgload" });
  return h("img", { className, src, alt: "", draggable: false });
}

interface LightboxProps {
  items: any[];
  index: number;
  type: string;
  uid: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}

function Lightbox({ items, index, type, uid, onClose, onIndex }: LightboxProps) {
  const it = items[index];
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const go = ({ Escape: -1, ArrowRight: index + 1, ArrowLeft: index - 1 } as Record<string, number>)[e.key];
      if (go === undefined) return;
      e.stopPropagation();
      if (go === -1) onClose();
      else if (go >= 0 && go < items.length) onIndex(go);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, items.length]);
  if (!it) return null;
  const url = mediaUrl(type, it.id, true);
  const save = () => {
    const a = document.createElement("a");
    a.href = src || "";
    a.download = `${type}_${it.id}.jpg`;
    a.click();
  };
  return h(
    "div",
    { className: "sl-lb", onMouseDown: (e) => e.target === e.currentTarget && onClose() },
    h(
      "div",
      { className: "sl-lb-top" },
      Chip({}, `${index + 1} / ${items.length}`),
      it.nsfw ? Chip({ className: "nsfw" }, "NSFW") : null,
      it.likes ? Chip({}, `♥ ${it.likes}`) : null,
      h("div", { style: { flex: 1 } }),
      h(IconBtn, { icon: "dl", title: "Сохранить", disabled: !src, onClick: save }),
      h(IconBtn, { icon: "close", title: "Закрыть (Esc)", onClick: onClose }),
    ),
    index > 0
      ? h(
          "button",
          { className: "sl-lb-nav l", "aria-label": "Предыдущее", onClick: () => onIndex(index - 1) },
          h(Icon, { name: "chev", size: 28 }),
        )
      : null,
    h(BlobImg, { key: url, url, referer: `/members/${uid}/media`, className: "sl-lb-img", onReady: setSrc }),
    index < items.length - 1
      ? h(
          "button",
          { className: "sl-lb-nav", "aria-label": "Следующее", onClick: () => onIndex(index + 1) },
          h(Icon, { name: "chev", size: 28 }),
        )
      : null,
  );
}

function Grid({ uid, type }: { uid: string; type: string }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(-1);
  const [nsfw, setNsfw] = useState(false);
  const st = useLoad((f: boolean) => api.photos(uid, type, page, f), [uid, type, page]);
  const wide = type === "streams" ? " wide" : "";
  return State(
    {
      st,
      left: (d: any) => {
        const n = (d?.items || []).filter((x: any) => x.nsfw).length;
        return n
          ? h(
              "label",
              { className: "sl-check" },
              h("input", { type: "checkbox", checked: nsfw, onChange: (e) => setNsfw(e.target.checked) }),
              `показать NSFW (${n})`,
            )
          : null;
      },
      skeleton: h(
        "div",
        { className: "sl-media" + wide },
        Array.from({ length: 6 }, (_, i) => h("div", { key: i, className: "sl-thumb sl-imgload" })),
      ),
    },
    (d: any) => {
      const items = (Array.isArray(d?.items) ? d.items : []).filter((x: any) => !x.user_id || x.user_id === uid);
      if (!items.length && page === 0)
        return h(Empty, { icon: "🖼️", text: `${MEDIA_TYPES.find(([k]) => k === type)?.[1] || "Медиа"}: пусто.` });
      return h(
        "div",
        null,
        h(
          "div",
          { className: "sl-media" + wide },
          items.map((it: any, i: number) =>
            h(
              "div",
              {
                key: it.id,
                className: "sl-thumb" + (it.nsfw && !nsfw ? " blur" : ""),
                style: delay(i),
                title: `ID: ${it.id}`,
                onClick: () => setOpen(i),
              },
              h(BlobImg, { url: mediaUrl(type, it.id), referer: `/members/${uid}/media` }),
              it.nsfw ? h("span", { className: "sl-badge nsfw" }, "NSFW") : null,
              it.likes ? h("span", { className: "sl-badge likes" }, `♥ ${it.likes}`) : null,
            ),
          ),
        ),
        h(Pager, { page, setPage, hasNext: !!d?.paginator?.has_next }),
        open >= 0 ? guard("Просмотр", h(Lightbox, { items, index: open, type, uid, onClose: () => setOpen(-1), onIndex: setOpen })) : null,
      );
    },
  );
}

export function MediaTab({ uid }: { uid: string }) {
  const [type, setType] = useState("avatars");
  return h(
    "div",
    null,
    h(Seg, { className: "sl-subtabs", value: type, onChange: setType, options: MEDIA_TYPES.map(([k, l]) => [k, l]) }),
    h(Grid, { key: type, uid, type }),
  );
}
