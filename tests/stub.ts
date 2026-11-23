export const disk: Record<string, Record<string, unknown>> = {};
export const calls: string[] = [];
export let responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }> = [];

export const setResponses = (r: typeof responses) => {
  responses = r;
};

const g = globalThis as any;
g.BdApi = {
  React: { createElement: () => null, useState: () => [], useEffect: () => {}, useRef: () => ({}) },
  Data: {
    load: (file: string, key: string) => disk[file]?.[key],
    save: (file: string, key: string, v: unknown) => {
      (disk[file] ??= {})[key] = JSON.parse(JSON.stringify(v));
    },
  },
  Net: {
    fetch: async (url: string) => {
      calls.push(url);
      const r = responses.shift() ?? { status: 200, body: { ok: true } };
      const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
      return {
        status: r.status,
        ok: r.status >= 200 && r.status < 300,
        headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
        text: async () => text,
      };
    },
  },
  UI: { showToast: () => {} },
};

disk.SensorLookup = {
  settings: { sessionid: "11111111-2222-3333-4444-555555555555", cfClearance: "x".repeat(120), userAgent: "Mozilla/5.0 (Test)" },
};
