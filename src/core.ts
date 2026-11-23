export const NAME = "SensorLookup";
export const BASE = "https://discord-sensor.com";
export const GUIDE = "Настройки плагина → «Как получить токены»";

export type Node = any;
export interface DomProps {
  [k: string]: any;
  onClick?: (e: any) => void;
  onChange?: (e: any) => void;
  onMouseDown?: (e: any) => void;
  onError?: (e: any) => void;
}
export const h = BdApi.React.createElement as {
  (type: () => Node): Node;
  <P>(type: (p: P) => Node, props: P, ...kids: Node[]): Node;
  (type: string, props?: DomProps | null, ...kids: Node[]): Node;
};
export const { useState, useEffect, useRef } = BdApi.React as {
  useState: <T>(v: T | (() => T)) => [T, (v: T | ((p: T) => T)) => void];
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
  useRef: <T>(v: T) => { current: T };
};

export interface Settings {
  sessionid: string;
  cfClearance: string;
  userAgent: string;
  cfSavedAt: number;
  cacheHours: number;
  cacheMb: number;
  privateCache: boolean;
  clearOnStop: boolean;
  lastTab: string;
  lastVersion: string;
  autoUpdate: boolean;
}

const DEFAULTS: Settings = {
  sessionid: "",
  cfClearance: "",
  userAgent: "",
  cfSavedAt: 0,
  cacheHours: 12,
  cacheMb: 3,
  privateCache: false,
  clearOnStop: false,
  lastTab: "info",
  lastVersion: "",
  autoUpdate: true,
};

export const loadSettings = (): Settings => ({ ...DEFAULTS, ...(BdApi.Data.load(NAME, "settings") || {}) });

export function saveSettings(s: Settings) {
  BdApi.Data.save(NAME, "settings", s);
}

export function patchSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  if ("cfClearance" in patch && patch.cfClearance) next.cfSavedAt = Date.now();
  saveSettings(next);
  return next;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function toast(text: string, type: "info" | "success" | "error" | "warning" = "info") {
  BdApi.UI.showToast(text, { type });
}

export function copy(text: unknown, what: string) {
  try {
    DiscordNative.clipboard.copy(String(text));
  } catch {
    navigator.clipboard?.writeText(String(text));
  }
  toast(`${what} скопирован`, "success");
}

let nav: any;
export function goChannel(guildId: string, channelId: string) {
  const path = `/channels/${guildId}/${channelId}`;
  try {
    nav ??=
      BdApi.Webpack.getByKeys("transitionTo") ||
      BdApi.Webpack.getModule((m: any) => typeof m?.transitionTo === "function", { searchExports: true });
    if (nav?.transitionTo) return nav.transitionTo(path);
  } catch {}
  copy("https://discord.com" + path, "Ссылка на канал");
}
