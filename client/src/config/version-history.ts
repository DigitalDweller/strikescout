/**
 * Version history shown on the home page.
 * Edit this file to add or update releases. Newest versions first.
 *
 * Change types:
 *   - feature    → New feature (green "New" badge)
 *   - improvement → Improvement (blue "Improved" badge)
 *   - fix        → Bug fix (amber "Fix" badge)
 */

export type ChangeType = "feature" | "improvement" | "fix";

export interface VersionChange {
  type: ChangeType;
  text: string;
}

export interface VersionEntry {
  /** Version number, e.g. "0.4.0" (displayed as "v0.4.0") */
  version: string;
  /** Release date, e.g. "Mar 2, 2026" */
  date: string;
  /** Optional label shown as badge, e.g. "latest" */
  tag?: string;
  changes: VersionChange[];
}

export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "1.0.0",
    date: "Mar 2, 2026",
    tag: "latest",
    changes: [
      { type: "feature", text: "Strikescout v1 launch" },
      { type: "improvement", text: "Scouting, schedule, picklist, and playoff predictor" },
    ],
  },
  {
    version: "0.5.0",
    date: "Mar 2, 2026",
    changes: [
      { type: "fix", text: "Stability and polish before v1" },
    ],
  },
];
