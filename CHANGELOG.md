# Changelog

All notable changes to SensorLookup. Downloads are on the [releases page](https://github.com/dxvxlery/sensor-lookup/releases).

## 4.2.0 — 2026-11-23

### Added

- Self-update from the GitHub repository.
- A **Check** button in settings that makes a test request to the site.

### Improved

- Settings look like native Discord settings and are more compact.
- Search field and dropdowns styled like Discord.
- Shared voice totals are labelled as all-time or current page only.

### Fixed

- Removed the friends search that only looked at the current page.
- The nickname server filter is shown only when all nicknames fit on one page.

## 4.1.0 — 2026-11-23

### Added

- A what's-new window after updating.
- Self-update: the plugin checks for a new version and offers to install it.
- A **Check for updates** button in settings.

### Improved

- If a tab fails to render, only that tab breaks and the rest of the window keeps working.

## 4.0.0 — 2026-11-23

### Added

- Server sorting and filters.
- Totals and per-day grouping for shared voice sessions.
- cf_clearance age in settings and a private cache mode.

### Improved

- Cache lives in its own file with a size limit.
- Fewer requests and a bundle about a third smaller.

### Fixed

- Rate-limit responses are handled with a pause and a retry.
