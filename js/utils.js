/**
 * utils.js — small, dependency-free helpers.
 * Attaches to the global `Ledger` namespace so every other file
 * (loaded via plain <script> tags, no bundler) can read `Ledger.utils`.
 */
window.Ledger = window.Ledger || {};

Ledger.utils = (function () {
  "use strict";

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function dayKey(timestamp) {
    const d = new Date(timestamp);
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function isSameDay(a, b) {
    return dayKey(a) === dayKey(b);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function formatDate(date) {
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return formatter.format(date);
  }

  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  /**
   * Formats a due-date timestamp relative to today for the task row badge.
   * "Overdue" / "Today" / "Tomorrow" / weekday name / short date.
   */
  function formatDueDate(ts) {
    if (!ts) return "";
    const today = startOfDay(Date.now());
    const target = startOfDay(ts);
    const diffDays = Math.round((target - today) / DAY_MS);

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 1 && diffDays < 7) {
      return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(target));
    }
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(target));
  }

  function dueDateStatus(ts) {
    if (!ts) return null;
    const today = startOfDay(Date.now());
    const target = startOfDay(ts);
    if (target < today) return "overdue";
    if (target === today) return "today";
    return "upcoming";
  }

  /**
   * Resolves a small set of natural-language date tokens to a start-of-day
   * timestamp. Supports: today, tomorrow, mon..sun (next occurrence),
   * and "in<N>d" / "in<N>w" (e.g. in3d, in2w).
   * Returns null if the token isn't recognized as a date.
   */
  function resolveDateToken(token) {
    const t = token.toLowerCase();
    const today = startOfDay(Date.now());

    if (t === "today") return today;
    if (t === "tomorrow" || t === "tmrw") return today + DAY_MS;

    const weekdayIdx = WEEKDAYS.indexOf(t);
    if (weekdayIdx !== -1) {
      const now = new Date(today);
      const currentIdx = now.getDay();
      let delta = weekdayIdx - currentIdx;
      if (delta <= 0) delta += 7;
      return today + delta * DAY_MS;
    }

    const relMatch = t.match(/^in(\d+)([dw])$/);
    if (relMatch) {
      const n = Number(relMatch[1]);
      const unit = relMatch[2] === "w" ? 7 : 1;
      return today + n * unit * DAY_MS;
    }

    return null;
  }

  /** Detects whether the visitor has asked for reduced motion. */
  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /**
   * Full quick-add parser. Reads free text and pulls out structured pieces,
   * stripping each token from the saved task text:
   *
   *   "Ship the deck !!! @fri #work"
   *     -> { text: "Ship the deck", effort: "high", dueDate: <next Friday>,
   *          tags: ["work"], recurrence: null }
   *
   *   "Water plants *weekly @today #home"
   *     -> { text: "Water plants", recurrence: "weekly", dueDate: <today>,
   *          tags: ["home"], effort: null }
   *
   * Tokens: "!"/"!!"/"!!!" effort · "@today|tomorrow|mon..sun|inNd|inNw" due
   * date · "#tag" tags (repeatable) · "*daily|*weekly" recurrence.
   */
  function parseQuickAdd(raw) {
    let text = (raw || "").trim();
    let effort = null;
    let dueDate = null;
    let recurrence = null;
    const tags = [];

    const effortMatch = text.match(/(?:^|\s)(!{1,3})(?:\s|$)/);
    if (effortMatch) {
      const levels = { "!": "low", "!!": "med", "!!!": "high" };
      effort = levels[effortMatch[1]];
      text = (text.slice(0, effortMatch.index) + " " + text.slice(effortMatch.index + effortMatch[0].length)).trim();
    }
    // also allow trailing "!" with no surrounding space, e.g. "Ship it!!!"
    if (!effortMatch) {
      const trailing = text.match(/^(.*?)\s*(!{1,3})$/);
      if (trailing) {
        const levels = { "!": "low", "!!": "med", "!!!": "high" };
        effort = levels[trailing[2]];
        text = trailing[1].trim();
      }
    }

    text = text.replace(/(?:^|\s)@(\w+)/g, (m, token) => {
      const resolved = resolveDateToken(token);
      if (resolved !== null) {
        dueDate = resolved;
        return " ";
      }
      return m; // not a recognized date token — leave it in the text
    }).trim();

    text = text.replace(/(?:^|\s)#([a-zA-Z0-9_-]+)/g, (m, tag) => {
      tags.push(tag.toLowerCase());
      return " ";
    }).trim();

    text = text.replace(/(?:^|\s)\*(daily|weekly|weekdays)/i, (m, rec) => {
      recurrence = rec.toLowerCase();
      return " ";
    }).trim();

    let priority = null;
    text = text.replace(/(?:^|\s)\^([1-4])(?:\s|$)/, (m, p) => {
      priority = Number(p);
      return " ";
    }).trim();

    text = text.replace(/\s{2,}/g, " ").trim();

    return { text, effort, dueDate, tags, recurrence, priority };
  }

  function cycleEffort(current) {
    const order = ["low", "med", "high"];
    const idx = order.indexOf(current);
    return order[(idx + 1) % order.length];
  }

  /** Advances a due-date timestamp forward by one recurrence step. */
  function nextRecurrence(fromTs, recurrence) {
    const base = startOfDay(fromTs || Date.now());
    if (recurrence === "daily") return base + DAY_MS;
    if (recurrence === "weekly") return base + 7 * DAY_MS;
    if (recurrence === "weekdays") {
      let next = base + DAY_MS;
      const day = new Date(next).getDay();
      if (day === 0) next += DAY_MS; // Sun -> Mon
      if (day === 6) next += 2 * DAY_MS; // Sat -> Mon
      return next;
    }
    return null;
  }

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * Minimal accessible focus trap for modal/overlay surfaces.
   * `activate()` remembers whatever had focus before opening, moves focus
   * into the container, and cycles Tab/Shift+Tab within it.
   * `deactivate()` releases the Tab handler and restores focus to the
   * element that opened the overlay — the behavior screen-reader and
   * keyboard-only users depend on to not get lost when a dialog closes.
   */
  function trapFocus(container) {
    let lastFocused = null;
    let onKeydown = null;

    function focusables() {
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
    }

    function activate() {
      lastFocused = document.activeElement;
      onKeydown = function (e) {
        if (e.key !== "Tab") return;
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      container.addEventListener("keydown", onKeydown);
      const items = focusables();
      const autofocusTarget = container.querySelector("[data-autofocus]");
      (autofocusTarget || items[0] || container).focus({ preventScroll: true });
    }

    function deactivate() {
      if (onKeydown) container.removeEventListener("keydown", onKeydown);
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus({ preventScroll: true });
      }
      lastFocused = null;
    }

    return { activate, deactivate };
  }

  return {
    uid,
    dayKey,
    isSameDay,
    clamp,
    formatDate,
    formatDueDate,
    dueDateStatus,
    startOfDay,
    prefersReducedMotion,
    parseQuickAdd,
    cycleEffort,
    nextRecurrence,
    trapFocus,
  };
})();
