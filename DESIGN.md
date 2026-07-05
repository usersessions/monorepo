# DESIGN.md — Phase 0 tokens (implementation: packages/shared/src/tokens.css)

No hex codes, arbitrary pixels, or one-off fonts anywhere else in the codebase. Extend this table first, then use the new token everywhere.

## Color
| Token | Value | Single role |
|---|---|---|
| --ink | #09090F | Primary background |
| --ink-2 | #0F0F1A | Cards, sidebar, modals, table headers |
| --paper | #F4F2ED | Primary text |
| --muted | #A8A5A0 | Secondary text |
| --muted-2 | #6B6862 | Disabled, placeholders |
| --border | #232330 | All hairline borders |
| --primary | #6366F1 | Interactive CTAs ONLY. Never status or data. |
| --primary-dim | #6366F11A | Primary hover bg only |
| --cyan | #22D3EE | Real-time / live signals ONLY |
| --green | #34D399 | Hard positive status ONLY |
| --amber | #FBBF24 | Hard warning ONLY |
| --red | #F87171 | Hard negative ONLY |

**Color communicates exactly one thing.** --cyan = happening now. --green/--amber/--red = fixed state. --primary = click this.

## Typography
| Token | Family | Role |
|---|---|---|
| --font-serif | Instrument Serif | Italic wordmark, large metric numbers, page H1s only |
| --font-sans | Syne | All other UI |
| --font-mono | DM Mono | Every numeric value, timestamp, status, ID. Data is always mono. |

Utility classes (defined once): .font-serif-metric, .font-sans-label, .font-sans-body, .font-mono-data, .font-mono-label, .font-mono-micro

## Spacing
--space-xs 4px · --space-sm 8px · --space-md 16px · --space-lg 24px · --space-xl 40px · --space-2xl 64px. Nothing off-scale — if none fits, reconsider the layout.

## Radius & elevation
--rounded-sm 4px (buttons/inputs/badges) · --rounded-md 8px (cards/modals) · --rounded-lg 16px (hero panels only) · --shadow-glow-primary: 0 0 24px var(--primary-dim) (primary CTA hover only)

## Layout
Dashboard content max-width 1280px centered · sidebar 224px · card padding --space-lg (--space-md dense tables) · 48px grid overlay is extension-popup ONLY.

## Status classes (identical everywhere)
.status-live --green · .status-pending --amber · .status-dead --red · .status-running --cyan
