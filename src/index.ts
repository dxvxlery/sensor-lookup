import { h, NAME, loadSettings, toast } from "./core";
import { flush, pendingSave, clearCache } from "./cache";
import { freeBlobs } from "./media";
import { Lookup } from "./ui/lookup";
import { SettingsPanel } from "./ui/settings";
import { guard } from "./ui/boundary";
import { showChangelog, VERSION } from "./changelog";
import { scheduleUpdates } from "./update";
import css from "./styles.css";

const MENUS = ["user-context", "guild-user-context", "user-profile-actions", "user-profile-overflow-menu"];

let mounted: { el: HTMLElement; root: any } | null = null;

function makeRoot(el: HTMLElement) {
  const RD = BdApi.ReactDOM;
  if (typeof RD?.createRoot === "function") return RD.createRoot(el);
  const client = BdApi.Webpack.getModule((m: any) => typeof m?.createRoot === "function" && typeof m?.hydrateRoot === "function");
  if (client) return client.createRoot(el);
  return { render: (n: any) => RD.render(n, el), unmount: () => RD.unmountComponentAtNode(el) };
}

function close() {
  if (!mounted) return;
  mounted.root.unmount();
  mounted.el.remove();
  mounted = null;
  freeBlobs();
}

function open(user: any) {
  close();
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = makeRoot(el);
  mounted = { el, root };
  root.render(
    h(Lookup, {
      initial: {
        id: user.id,
        name: user.globalName || user.global_name || user.username,
        handle: user.username,
        avatar: typeof user.getAvatarURL === "function" ? user.getAvatarURL(null, 128, true) : null,
      },
      onClose: close,
    }),
  );
}

export default class SensorLookup {
  unpatch: Array<() => void> = [];
  stopUpdates = () => {};

  start() {
    BdApi.DOM.addStyle(NAME, css);
    BdApi.Data.delete?.(NAME, "cache");
    const patch = (tree: any, props: any) => {
      const user = props?.user;
      const kids = tree?.props?.children;
      if (!user?.id || !Array.isArray(kids) || kids.some((k: any) => k?.props?.id === "sensor-lookup")) return;
      kids.push(
        BdApi.ContextMenu.buildItem({ type: "separator" }),
        BdApi.ContextMenu.buildItem({ type: "text", id: "sensor-lookup", label: "Discord Sensor", action: () => open(user) }),
      );
    };
    this.unpatch = MENUS.map((m) => BdApi.ContextMenu.patch(m, patch));
    showChangelog();
    this.stopUpdates = scheduleUpdates(VERSION);
    if (!loadSettings().sessionid) toast("SensorLookup: открой настройки плагина и добавь токены с discord-sensor.com", "info");
  }

  stop() {
    this.unpatch.forEach((u) => u?.());
    this.unpatch = [];
    this.stopUpdates();
    close();
    if (loadSettings().clearOnStop) clearCache();
    else if (pendingSave()) flush();
    BdApi.DOM.removeStyle(NAME);
  }

  getSettingsPanel() {
    return guard("Настройки", h(SettingsPanel));
  }
}
