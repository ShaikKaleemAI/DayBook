# Daybook — a load-aware to-do list

![status](https://img.shields.io/badge/status-active-brightgreen)
![stack](https://img.shields.io/badge/stack-vanilla%20JS-yellow)
![deps](https://img.shields.io/badge/dependencies-zero-informational)
![tests](https://img.shields.io/badge/tests-45%2F45%20passing-success)
![license](https://img.shields.io/badge/license-MIT-blue)

**Live demo:** [my-to-do-tool.netlify.app](https://my-to-do-tool.netlify.app)

> Formerly "Ledger." Renamed to Daybook, redesigned for desktop, and shipped
> with a fully editable activity chart.

A to-do app built around one idea most to-do apps ignore: **not all tasks
cost the same**. Every task carries an effort weight (low / med / high), a
live load bar shows how full today already is against a capacity budget, and
Focus Mode strips everything away to surface just the one task that matters
right now, with a built-in timer.

Zero dependencies, zero build step, zero backend — plain HTML/CSS/JS,
engineered like a small production app: a hand-rolled pub-sub store, a dumb
render layer, and single-purpose modules for theming, undo, drag reorder,
gestures, the command palette, and Focus Mode.

---

## Table of contents

- [The problem this solves](#the-problem-this-solves)
- [What makes it different](#what-makes-it-different)
- [Design pass — the ledger metaphor](#design-pass-the-ledger-metaphor-taken-seriously)
- [The weekly statement](#the-weekly-statement)
- [Architecture](#architecture)
- [Latest changes](#latest-changes)
- [Running it](#running-it)
- [Testing](#testing)
- [Roadmap to production scale](#roadmap-to-production-scale)
- [Honest scope notes](#honest-scope-notes)

---

## The problem this solves

Most to-do apps treat every task as equal: one row, one checkbox, one line
of text. That's honest about *what* you have to do and dishonest about *how
much room you actually have* — a day with three hard tasks isn't the same
as a day with ten easy ones, but a plain checklist can't tell you that.
Daybook makes effort visible and budgets against it, the way a sprint board
budgets story points, so "3 tasks left" turns into something you can
actually plan a day around.

## What makes it different

- **Load-aware planning** — tag a task's effort inline while typing
  (`Ship the deck !!!` → high effort), and a live load bar tracks total
  remaining effort against a capacity you set. Go over, the bar turns a
  warning color — a soft, honest signal instead of a guilt trip.
- **Focus Mode** (`F`) — a distraction-free full-screen view of exactly one
  task: the oldest thing still undone. Built-in 25-minute timer with an
  animated progress ring. Mark done and it advances automatically.
- **Command palette** (`⌘/Ctrl K`) — a fuzzy-searchable action list
  (filters, theme, capacity, undo, Focus Mode) in the Linear/Raycast style,
  fully keyboard-navigable.
- **Bulk actions** (`X`) — select multiple tasks and complete or delete them
  in one step from a floating action bar, with undo.
- **Swipe gestures** — on touch devices, swipe a task right to complete or
  left to delete, with the same undo safety net as the desktop delete
  button.
- **Rich quick-add syntax** — one line does it all: effort (`!`/`!!`/`!!!`),
  due date (`@today`, `@fri`, `@in3d`), tags (`#work`), and recurrence
  (`*daily`, `*weekly`, `*weekdays`) — e.g. `Ship the deck !!! @fri #work`.
- **Due dates, tags, subtasks, recurring tasks, search, backup/restore, and
  offline install** — all first-class, not bolted on.

## Design pass: the ledger metaphor, taken seriously

- **The stamp.** Completing a task presses like a wax/ink stamp
  (`stampPress`), an ink ring ripples outward, and a soft ink bloom
  dissolves behind it — the one moment the app is built to make satisfying.
- **The gauge, not a progress bar.** The load bar has tick marks like a
  ruler and an honest three-stage color signal (room → tight → over).
- **Paper grain.** A near-invisible SVG-turbulence texture sits over the
  whole page — no image assets.
- **A cover-opening entrance.** Header, toolbar, gauge, and card rise in as
  one orchestrated sequence; the task list cascades row by row.
- **Letterpress wordmark** with a two-tone text-shadow tuned per theme.

Every addition respects `prefers-reduced-motion` and adds no new
dependencies.

## The weekly statement

Press `S` (or open the command palette) for a **statement of account** — the
thing an actual ledger produces, computed live from the store with no new
persistence:

- A 7-day bar chart of effort cleared per day (raw SVG, no charting library)
- Entries this week, effort cleared, current streak, and best-ever streak
- Top tags by completed-entry count
- **"Your Rhythm"** — all-time completions bucketed into six 4-hour windows,
  with a plain-language callout (e.g. "Most cleared between 4–8pm — 12 of 30
  entries")

## Architecture

```
daybook/
├── index.html
├── css/
│   ├── tokens.css        design tokens: color, type, spacing, motion
│   ├── base.css          reset + global element defaults
│   ├── layout.css        page shell, header, card frame
│   ├── components.css    buttons, inputs, rows, ring, toast, modal
│   ├── elevate.css       load bar, effort dots, Focus Mode, palette,
│   │                     toolbar/search, tags, due dates, subtasks
│   ├── animations.css    all @keyframes, reduced-motion override
│   └── responsive.css    breakpoints only
└── js/
    ├── utils.js          pure helpers — id gen, date math, quick-add
    │                     parsing, no DOM, no state
    ├── store.js          single source of truth: pub/sub store
    │                     (EventTarget) owning tasks, effort, load
    │                     capacity, persistence, streaks, undo
    ├── theme.js          night ledger ⇄ day paper, persisted
    ├── toast.js          undo notifications
    ├── dragdrop.js       native HTML5 drag-to-reorder
    ├── gestures.js       touch swipe-to-complete / delete
    ├── shortcuts.js      global keyboard shortcuts + help
    ├── palette.js        command palette (fuzzy search)
    ├── render.js         the only module that touches the DOM;
    │                     reads store, never mutates it
    └── app.js            composition root — wires DOM events +
                          Focus Mode timer to store methods
```

**Data flow is one-way:** a user action calls a `store` method → the store
mutates its own state, persists to `localStorage`, and emits a `change`
event → `app.js`'s listener calls `render.all(store)` → `render.js` rebuilds
the DOM from current state. Nothing outside `store.js` ever mutates a task
directly.

## Latest changes

- **Accessible focus management.** All four overlay surfaces — the activity
  statement, Focus Mode, the shortcuts panel, and the command palette — now
  trap `Tab`/`Shift+Tab` inside themselves and return focus to whatever
  triggered them on close, via a reusable `Ledger.utils.trapFocus()`
  helper. A skip-to-content link was also added ahead of the sidebar.
- **Bulk actions.** Select mode adds a checkbox per row and a floating
  action bar to complete/delete everything selected in one step, each with
  the same undo toast as a single delete. Covered by 7 new unit tests —
  **45/45 tests passing.**
- **Fixed a real mobile bug**, not just a style tweak: search and
  command-palette inputs rendered text under 16px, which triggers
  iOS/Android auto-zoom-on-focus that doesn't reliably reset on blur. Fixed
  at the input level, backed by a global rule so this class of bug can't
  come back.
- **New default theme: professional white** — a true white surface with a
  deep oxblood-red accent standing in for ledger ink, now the default on
  first load.

## Running it

Open `index.html` directly — every script is a plain classic `<script src>`,
no bundler required. Or drag the folder into Netlify, Vercel, GitHub Pages,
or Cloudflare Pages: no build command, no output directory, the project
root is the deployable unit.

## Testing

```bash
npm test
```

`tests/run.js` runs a dependency-free suite against `store.js` and
`utils.js` — task mutations, undo/redo buffers, recurrence spawning,
load/capacity math, filtering and search, and JSON export/import
round-tripping. `render.js` and `app.js` (DOM wiring) are intentionally out
of scope for this layer and would be covered by Playwright E2E tests next.
CI (`.github/workflows/ci.yml`) runs the suite on every push and PR to
`main`.

## Roadmap to production scale

This is deliberately a client-only, single-user, `localStorage`-backed app
— that's a real, named limitation, not an oversight. Highest-leverage next
steps, in order:

1. **A real backend + accounts** — an API (Node/Express or a BaaS like
   Supabase) with Postgres behind it, plus auth.
2. **Real-time multi-device sync**, replacing manual JSON export/import.
3. **E2E tests** (Playwright) over the DOM-facing modules the unit suite
   doesn't reach.
4. **List virtualization** for very large task counts, plus a
   Lighthouse/axe accessibility pass under load.

## Honest scope notes

There's no accounts, no real-time multi-device sync, no server. JSON
export/import covers backup and manual device transfer, but it's not sync.
That's a deliberate scope choice: this demonstrates frontend architecture,
state management, and interaction design depth, not full-stack or systems
work.
