import { RELEASES, type Notes, type Release } from "./releases.ts";

export const EN: Record<string, Notes> = {
  "4.3.0": {
    added: [
      "An **Events** tab: voice channel history and server joins and leaves.",
      "Friend sorting: most or least time together, most or least recently together.",
      "Click a voice event to see who else was in the channel and for how long; click a person to open their profile.",
    ],
    fixed: ["Friend numbering on the last page is correct now."],
  },
  "4.2.0": {
    added: ["Self-update from the GitHub repository.", "A **Check** button in settings that makes a test request to the site."],
    improved: [
      "Settings look like native Discord settings and are more compact.",
      "Search field and dropdowns styled like Discord.",
      "Shared voice totals are labelled as all-time or current page only.",
    ],
    fixed: [
      "Removed the friends search that only looked at the current page.",
      "The nickname server filter is shown only when all nicknames fit on one page.",
    ],
  },
  "4.1.0": {
    added: [
      "A what's-new window after updating.",
      "Self-update: the plugin checks for a new version and offers to install it.",
      "A **Check for updates** button in settings.",
    ],
    improved: ["If a tab fails to render, only that tab breaks and the rest of the window keeps working."],
  },
  "4.0.0": {
    added: [
      "Server sorting and filters.",
      "Totals and per-day grouping for shared voice sessions.",
      "cf_clearance age in settings and a private cache mode.",
    ],
    improved: ["Cache lives in its own file with a size limit.", "Fewer requests and a bundle about a third smaller."],
    fixed: ["Rate-limit responses are handled with a pause and a retry."],
  },
};

const HEADINGS: [keyof Notes, string][] = [
  ["added", "Added"],
  ["improved", "Improved"],
  ["fixed", "Fixed"],
];

export function releaseMarkdown(r: Release) {
  const n = EN[r.version] ?? {};
  return HEADINGS.filter(([k]) => n[k]?.length)
    .map(([k, title]) => `### ${title}\n\n${n[k]!.map((i) => `- ${i}`).join("\n")}`)
    .join("\n\n");
}

export function changelogMarkdown(repo: string) {
  const body = RELEASES.map((r) => `## ${r.version} — ${r.date}\n\n${releaseMarkdown(r)}`).join("\n\n");
  return `# Changelog\n\nAll notable changes to SensorLookup. Downloads are on the [releases page](${repo}/releases).\n\n${body}\n`;
}

export { RELEASES };
