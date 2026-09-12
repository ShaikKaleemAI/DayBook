/**
 * store.js — a tiny Redux-style store, built from scratch (no dependency).
 *
 * Responsibilities:
 *  - Own the single source of truth for tasks + active filter/search/tag.
 *  - Persist to localStorage after every mutation.
 *  - Emit a 'change' CustomEvent (via EventTarget) so the render layer
 *    can stay a dumb, one-way subscriber — it never mutates state itself.
 *  - Track a day-streak of "at least one task completed."
 *  - Hold short-lived undo buffers for delete / clear-completed.
 *  - Handle recurring tasks: completing one spawns the next occurrence.
 *  - Provide JSON export/import for backup and cross-device transfer.
 */
window.Ledger = window.Ledger || {};

Ledger.Store = (function () {
  "use strict";

  const TASKS_KEY = "ledger.tasks.v4";
  const TASKS_KEY_LEGACY = "ledger.tasks.v3";
  const FILTER_KEY = "ledger.filter.v3";
  const STREAK_KEY = "ledger.completedDays.v3";
  const CAPACITY_KEY = "ledger.capacity.v3";
  const { uid, dayKey, isSameDay, nextRecurrence } = Ledger.utils;

  const EFFORT_WEIGHT = { low: 1, med: 2, high: 3 };
  const DEFAULT_CAPACITY = 8;

  class Store extends EventTarget {
    constructor() {
      super();
      this.tasks = this._loadTasks();
      this.filter = this._loadFilter();
      this.completedDays = this._loadStreakDays();
      this.capacity = this._loadCapacity();
      this.search = "";
      this.activeTag = null;

      // transient (not persisted) undo buffers
      this._lastDeleted = null; // { task, index }
      this._lastCleared = null; // [{ task, index }, ...]
      this._lastBulkDeleted = null; // [{ task, index }, ...]
      this._lastBulkCompleted = null; // [{ id, prevCompleted, prevCompletedAt }, ...]

      // transient (not persisted) multi-select state, for bulk actions
      this.selectMode = false;
      this.selectedIds = new Set();
    }

    // ---------------------------------------------------------------- I/O

    _normalizeTask(t) {
      return {
        id: t.id,
        text: t.text,
        completed: t.completed,
        createdAt: t.createdAt,
        completedAt: t.completedAt ?? null,
        effort: EFFORT_WEIGHT[t.effort] ? t.effort : "med",
        tags: Array.isArray(t.tags) ? t.tags.filter((x) => typeof x === "string") : [],
        dueDate: typeof t.dueDate === "number" ? t.dueDate : null,
        recurrence: ["daily", "weekly", "weekdays"].includes(t.recurrence) ? t.recurrence : null,
        priority: [1, 2, 3, 4].includes(t.priority) ? t.priority : 4,
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks
              .filter((s) => s && typeof s.id === "string" && typeof s.text === "string")
              .map((s) => ({ id: s.id, text: s.text, completed: !!s.completed }))
          : [],
      };
    }

    _loadTasks() {
      try {
        let raw = localStorage.getItem(TASKS_KEY);
        if (!raw) raw = localStorage.getItem(TASKS_KEY_LEGACY); // migrate from v3
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter(
            (t) =>
              t &&
              typeof t.id === "string" &&
              typeof t.text === "string" &&
              typeof t.completed === "boolean" &&
              typeof t.createdAt === "number"
          )
          .map((t) => this._normalizeTask(t));
      } catch (err) {
        console.warn("Ledger: could not read saved tasks.", err);
        return [];
      }
    }

    _loadCapacity() {
      try {
        const raw = Number(localStorage.getItem(CAPACITY_KEY));
        return raw && raw > 0 ? raw : DEFAULT_CAPACITY;
      } catch {
        return DEFAULT_CAPACITY;
      }
    }

    _persistCapacity() {
      try {
        localStorage.setItem(CAPACITY_KEY, String(this.capacity));
      } catch {
        /* ignore */
      }
    }

    _loadFilter() {
      try {
        const f = localStorage.getItem(FILTER_KEY);
        return f === "active" || f === "completed" ? f : "all";
      } catch {
        return "all";
      }
    }

    _loadStreakDays() {
      try {
        const raw = localStorage.getItem(STREAK_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch {
        return new Set();
      }
    }

    _persistTasks() {
      try {
        localStorage.setItem(TASKS_KEY, JSON.stringify(this.tasks));
      } catch (err) {
        console.warn("Ledger: could not save tasks.", err);
      }
    }

    _persistFilter() {
      try {
        localStorage.setItem(FILTER_KEY, this.filter);
      } catch {
        /* ignore */
      }
    }

    _persistStreak() {
      try {
        localStorage.setItem(
          STREAK_KEY,
          JSON.stringify(Array.from(this.completedDays))
        );
      } catch {
        /* ignore */
      }
    }

    _emit(type, payload) {
      this.dispatchEvent(new CustomEvent("change", { detail: { type, payload } }));
    }

    // ------------------------------------------------------------- reads

    getTasks() {
      return this.tasks;
    }

    getFilter() {
      return this.filter;
    }

    getSearch() {
      return this.search;
    }

    getActiveTag() {
      return this.activeTag;
    }

    getAllTags() {
      const set = new Set();
      this.tasks.forEach((t) => t.tags.forEach((tag) => set.add(tag)));
      return Array.from(set).sort();
    }

    getVisibleTasks() {
      let list = this.tasks;
      if (this.filter === "active") list = list.filter((t) => !t.completed);
      else if (this.filter === "completed") list = list.filter((t) => t.completed);

      if (this.activeTag) list = list.filter((t) => t.tags.includes(this.activeTag));

      if (this.search.trim()) {
        const q = this.search.trim().toLowerCase();
        list = list.filter(
          (t) =>
            t.text.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.includes(q))
        );
      }
      return list;
    }

    getCounts() {
      const total = this.tasks.length;
      const completed = this.tasks.filter((t) => t.completed).length;
      return { total, completed, active: total - completed };
    }

    getOverdueCount() {
      const today = Ledger.utils.startOfDay(Date.now());
      return this.tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today).length;
    }

    /** Consecutive-day streak of "completed at least one task," anchored to today/yesterday. */
    getStreak() {
      const days = this.completedDays;
      if (days.size === 0) return 0;

      let count = 0;
      let cursor = new Date();

      if (!days.has(dayKey(cursor.getTime()))) {
        cursor.setDate(cursor.getDate() - 1);
      }

      while (days.has(dayKey(cursor.getTime()))) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return count;
    }

    /** Fraction of *today's* logged tasks that are completed, for the progress ring. */
    getTodayProgress() {
      const now = Date.now();
      const todays = this.tasks.filter((t) => isSameDay(t.createdAt, now));
      if (todays.length === 0) return { percent: 0, total: 0, completed: 0 };
      const completed = todays.filter((t) => t.completed).length;
      return {
        percent: Math.round((completed / todays.length) * 100),
        total: todays.length,
        completed,
      };
    }

    /** Sum of effort-weight across incomplete tasks, vs. the daily capacity budget. */
    getTodayLoad() {
      const used = this.tasks
        .filter((t) => !t.completed)
        .reduce((sum, t) => sum + (EFFORT_WEIGHT[t.effort] || EFFORT_WEIGHT.med), 0);
      return {
        used,
        capacity: this.capacity,
        percent: Math.min(100, Math.round((used / this.capacity) * 100)),
        overCapacity: used > this.capacity,
      };
    }

    /**
     * Activity statement: the ledger's actual bookkeeping deliverable.
     * Last N days (default 7) of completed-effort, best-ever streak, and
     * the tags that carried the most entries. Pure read — no persistence.
     * `rangeDays` is fully caller-controlled so the statement UI can offer
     * 7 / 14 / 30 / 84-day (12-week) views on the same data.
     */
    getStatement(rangeDays) {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const todayStart = Ledger.utils.startOfDay(Date.now());
      const N = Math.max(1, Math.min(180, Number(rangeDays) || 7));
      const weekly = N > 31; // 12-week view: bucket by week instead of by day

      const days = [];
      if (!weekly) {
        for (let i = N - 1; i >= 0; i--) {
          const dayStart = todayStart - i * DAY_MS;
          const dayEnd = dayStart + DAY_MS;
          const completedThatDay = this.tasks.filter(
            (t) => t.completed && t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd
          );
          const effort = completedThatDay.reduce(
            (sum, t) => sum + (EFFORT_WEIGHT[t.effort] || EFFORT_WEIGHT.med),
            0
          );
          const label =
            N <= 7
              ? new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(dayStart))
              : new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(new Date(dayStart));
          days.push({ date: dayStart, label, count: completedThatDay.length, effort });
        }
      } else {
        const weeks = Math.round(N / 7);
        for (let w = weeks - 1; w >= 0; w--) {
          const dayStart = todayStart - w * 7 * DAY_MS;
          const dayEnd = dayStart + 7 * DAY_MS;
          const completedThatWeek = this.tasks.filter(
            (t) => t.completed && t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd
          );
          const effort = completedThatWeek.reduce(
            (sum, t) => sum + (EFFORT_WEIGHT[t.effort] || EFFORT_WEIGHT.med),
            0
          );
          days.push({
            date: dayStart,
            label: "W" + (weeks - w),
            count: completedThatWeek.length,
            effort,
          });
        }
      }

      // Best-ever streak: longest run of consecutive keys in completedDays.
      const sortedKeys = Array.from(this.completedDays).sort();
      let bestStreak = 0;
      let run = 0;
      let prevTs = null;
      sortedKeys.forEach((key) => {
        const [y, m, d] = key.split("-").map(Number);
        const ts = new Date(y, m - 1, d).getTime();
        if (prevTs !== null && ts - prevTs === DAY_MS) run += 1;
        else run = 1;
        bestStreak = Math.max(bestStreak, run);
        prevTs = ts;
      });

      const tagCounts = new Map();
      this.tasks
        .filter((t) => t.completed)
        .forEach((t) => t.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
      const topTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([tag, count]) => ({ tag, count }));

      const weekCompleted = days.reduce((sum, d) => sum + d.count, 0);
      const weekEffort = days.reduce((sum, d) => sum + d.effort, 0);

      return {
        days,
        weekCompleted,
        weekEffort,
        currentStreak: this.getStreak(),
        bestStreak,
        topTags,
        totalCompleted: this.tasks.filter((t) => t.completed).length,
      };
    }

    /**
     * Rhythm: what hour of the day entries actually get cleared, across all
     * completed tasks (all-time). Bucketed into 6 four-hour windows rather
     * than 24 raw hours — enough signal to see a pattern, not so much that
     * one busy afternoon looks like noise. Pure read, no persistence.
     */
    getRhythm() {
      const WINDOWS = [
        { key: "night", label: "12–4am", from: 0, to: 4 },
        { key: "earlyMorning", label: "4–8am", from: 4, to: 8 },
        { key: "morning", label: "8am–12pm", from: 8, to: 12 },
        { key: "afternoon", label: "12–4pm", from: 12, to: 16 },
        { key: "evening", label: "4–8pm", from: 16, to: 20 },
        { key: "lateNight", label: "8pm–12am", from: 20, to: 24 },
      ];
      const counts = WINDOWS.map(() => 0);
      let total = 0;
      this.tasks.forEach((t) => {
        if (!t.completed || !t.completedAt) return;
        const hour = new Date(t.completedAt).getHours();
        const idx = WINDOWS.findIndex((w) => hour >= w.from && hour < w.to);
        if (idx !== -1) {
          counts[idx] += 1;
          total += 1;
        }
      });
      const buckets = WINDOWS.map((w, i) => ({ ...w, count: counts[i] }));
      const peak = total > 0 ? buckets.reduce((a, b) => (b.count > a.count ? b : a)) : null;
      return { buckets, total, peak };
    }

    setCapacity(n) {
      const val = Number(n);
      if (!val || val <= 0) return;
      this.capacity = val;
      this._persistCapacity();
      this._emit("capacity", val);
    }

    /** The single next task Focus Mode should surface: oldest incomplete, in list order. */
    getFocusTask() {
      return this.tasks.find((t) => !t.completed) || null;
    }

    // --------------------------------------------------------- mutations

    /** Returns { ok:true, task } or { ok:false, error } — never throws. */
    addTask(rawText, effort, extra) {
      const text = (rawText || "").trim();
      if (!text) return { ok: false, error: "Write something first." };
      if (text.length > 140) return { ok: false, error: "Keep it under 140 characters." };

      const opts = extra || {};
      const task = {
        id: uid(),
        text,
        completed: false,
        createdAt: Date.now(),
        completedAt: null,
        effort: EFFORT_WEIGHT[effort] ? effort : "med",
        tags: Array.isArray(opts.tags) ? opts.tags : [],
        dueDate: typeof opts.dueDate === "number" ? opts.dueDate : null,
        recurrence: opts.recurrence || null,
        priority: [1, 2, 3, 4].includes(opts.priority) ? opts.priority : 4,
        subtasks: [],
      };
      this.tasks.push(task);
      this._persistTasks();
      this._emit("add", task);
      return { ok: true, task };
    }

    setEffort(id, effort) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task || !EFFORT_WEIGHT[effort]) return;
      task.effort = effort;
      this._persistTasks();
      this._emit("effort", task);
    }

    setDueDate(id, ts) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return;
      task.dueDate = typeof ts === "number" ? ts : null;
      this._persistTasks();
      this._emit("due", task);
    }

    setTags(id, tags) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return;
      task.tags = Array.from(new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean)));
      this._persistTasks();
      this._emit("tags", task);
    }

    setPriority(id, priority) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task || ![1, 2, 3, 4].includes(priority)) return;
      task.priority = priority;
      this._persistTasks();
      this._emit("priority", task);
    }

    /** Groups visible incomplete tasks into board columns, plus a recent-done column. */
    getBoardColumns() {
      const today = Ledger.utils.startOfDay(Date.now());
      const DAY_MS = 24 * 60 * 60 * 1000;
      const base = this.getVisibleTasks().filter((t) => !t.completed);
      const cols = { overdue: [], today: [], upcoming: [], someday: [] };
      base.forEach((t) => {
        if (!t.dueDate) cols.someday.push(t);
        else if (t.dueDate < today) cols.overdue.push(t);
        else if (t.dueDate === today) cols.today.push(t);
        else cols.upcoming.push(t);
      });
      const done = this.tasks
        .filter((t) => t.completed && t.completedAt && t.completedAt >= today - 6 * DAY_MS)
        .sort((a, b) => b.completedAt - a.completedAt);
      const byPriority = (a, b) => a.priority - b.priority;
      cols.overdue.sort(byPriority);
      cols.today.sort(byPriority);
      cols.upcoming.sort((a, b) => a.dueDate - b.dueDate || a.priority - b.priority);
      cols.someday.sort(byPriority);
      return { ...cols, done };
    }

    /** Whether every task logged today is complete (used to trigger the celebration moment). */
    isTodayCleared() {
      const p = this.getTodayProgress();
      return p.total > 0 && p.completed === p.total;
    }

    /** Last N weeks of completed-effort per day, for the statement heatmap. Monday-first grid. */
    getHeatmap(weeks) {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const todayStart = Ledger.utils.startOfDay(Date.now());
      const totalDays = weeks * 7;
      const startDow = (new Date(todayStart).getDay() + 6) % 7; // 0=Mon
      const gridStart = todayStart - (totalDays - 1 - (6 - startDow)) * DAY_MS;

      const byDay = new Map();
      this.tasks.forEach((t) => {
        if (!t.completed || !t.completedAt) return;
        const key = dayKey(t.completedAt);
        byDay.set(key, (byDay.get(key) || 0) + (EFFORT_WEIGHT[t.effort] || 2));
      });

      const cells = [];
      for (let i = 0; i < totalDays; i++) {
        const ts = gridStart + i * DAY_MS;
        if (ts > todayStart) break;
        cells.push({ date: ts, key: dayKey(ts), value: byDay.get(dayKey(ts)) || 0 });
      }
      return cells;
    }

    setRecurrence(id, recurrence) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return;
      task.recurrence = ["daily", "weekly", "weekdays"].includes(recurrence) ? recurrence : null;
      this._persistTasks();
      this._emit("recurrence", task);
    }

    addSubtask(taskId, text) {
      const task = this.tasks.find((t) => t.id === taskId);
      const clean = (text || "").trim();
      if (!task || !clean) return;
      task.subtasks.push({ id: uid(), text: clean, completed: false });
      this._persistTasks();
      this._emit("subtask", task);
    }

    toggleSubtask(taskId, subId) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const sub = task.subtasks.find((s) => s.id === subId);
      if (!sub) return;
      sub.completed = !sub.completed;
      this._persistTasks();
      this._emit("subtask", task);
    }

    deleteSubtask(taskId, subId) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task) return;
      task.subtasks = task.subtasks.filter((s) => s.id !== subId);
      this._persistTasks();
      this._emit("subtask", task);
    }

    toggleTask(id) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return;
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : null;

      if (task.completed) {
        this.completedDays.add(dayKey(Date.now()));
        this._persistStreak();

        // Recurring task: spawn the next occurrence, leaving this one as
        // a completed record (so streaks/history stay accurate).
        if (task.recurrence) {
          const nextDue = nextRecurrence(task.dueDate || Date.now(), task.recurrence);
          this.tasks.push({
            id: uid(),
            text: task.text,
            completed: false,
            createdAt: Date.now(),
            completedAt: null,
            effort: task.effort,
            tags: task.tags.slice(),
            dueDate: nextDue,
            recurrence: task.recurrence,
            subtasks: task.subtasks.map((s) => ({ id: uid(), text: s.text, completed: false })),
          });
        }
      }
      this._persistTasks();
      this._emit("toggle", task);
    }

    deleteTask(id) {
      const index = this.tasks.findIndex((t) => t.id === id);
      if (index === -1) return;
      const [task] = this.tasks.splice(index, 1);
      this._lastDeleted = { task, index };
      this._persistTasks();
      this._emit("delete", task);
    }

    undoDelete() {
      if (!this._lastDeleted) return false;
      const { task, index } = this._lastDeleted;
      const safeIndex = Math.min(index, this.tasks.length);
      this.tasks.splice(safeIndex, 0, task);
      this._lastDeleted = null;
      this._persistTasks();
      this._emit("restore", task);
      return true;
    }

    clearCompleted() {
      const removed = [];
      this.tasks = this.tasks.filter((t, i) => {
        if (t.completed) {
          removed.push({ task: t, index: i });
          return false;
        }
        return true;
      });
      if (removed.length === 0) return 0;
      this._lastCleared = removed;
      this._persistTasks();
      this._emit("clear", removed);
      return removed.length;
    }

    undoClearCompleted() {
      if (!this._lastCleared) return false;
      this._lastCleared
        .slice()
        .sort((a, b) => a.index - b.index)
        .forEach(({ task, index }) => {
          const safeIndex = Math.min(index, this.tasks.length);
          this.tasks.splice(safeIndex, 0, task);
        });
      this._lastCleared = null;
      this._persistTasks();
      this._emit("restore");
      return true;
    }

    // --------------------------------------------------------- multi-select

    /** Selection is transient UI state — never persisted, never survives reload. */
    isSelectMode() {
      return this.selectMode;
    }

    setSelectMode(on) {
      this.selectMode = !!on;
      if (!this.selectMode) this.selectedIds.clear();
      this._emit("selection");
    }

    toggleSelectMode() {
      this.setSelectMode(!this.selectMode);
    }

    isSelected(id) {
      return this.selectedIds.has(id);
    }

    getSelectionCount() {
      return this.selectedIds.size;
    }

    toggleSelect(id) {
      if (this.selectedIds.has(id)) this.selectedIds.delete(id);
      else this.selectedIds.add(id);
      this._emit("selection");
    }

    selectAllVisible() {
      this.getVisibleTasks().forEach((t) => this.selectedIds.add(t.id));
      this._emit("selection");
    }

    clearSelection() {
      this.selectedIds.clear();
      this._emit("selection");
    }

    /**
     * Marks every selected, not-yet-completed task done in one batch.
     * Deliberately does NOT spawn the next occurrence for recurring tasks
     * the way `toggleTask` does — firing N recurrence spawns from one bulk
     * action would be surprising, so bulk-complete is scoped to "clear
     * these off today's list" and recurrence stays a single-task action.
     */
    bulkComplete() {
      const ids = Array.from(this.selectedIds);
      const snapshot = [];
      let changed = 0;
      ids.forEach((id) => {
        const task = this.tasks.find((t) => t.id === id);
        if (!task || task.completed) return;
        snapshot.push({ id, prevCompleted: task.completed, prevCompletedAt: task.completedAt });
        task.completed = true;
        task.completedAt = Date.now();
        changed += 1;
      });
      if (changed === 0) return 0;
      this.completedDays.add(dayKey(Date.now()));
      this._persistStreak();
      this._lastBulkCompleted = snapshot;
      this._persistTasks();
      this.setSelectMode(false);
      this._emit("bulkComplete", changed);
      return changed;
    }

    undoBulkComplete() {
      if (!this._lastBulkCompleted) return false;
      this._lastBulkCompleted.forEach(({ id, prevCompleted, prevCompletedAt }) => {
        const task = this.tasks.find((t) => t.id === id);
        if (!task) return;
        task.completed = prevCompleted;
        task.completedAt = prevCompletedAt;
      });
      this._lastBulkCompleted = null;
      this._persistTasks();
      this._emit("restore");
      return true;
    }

    /** Removes every selected task, same {task,index} undo shape as clearCompleted. */
    bulkDelete() {
      const ids = new Set(this.selectedIds);
      if (ids.size === 0) return 0;
      const removed = [];
      this.tasks = this.tasks.filter((t, i) => {
        if (ids.has(t.id)) {
          removed.push({ task: t, index: i });
          return false;
        }
        return true;
      });
      if (removed.length === 0) return 0;
      this._lastBulkDeleted = removed;
      this._persistTasks();
      this.setSelectMode(false);
      this._emit("bulkDelete", removed.length);
      return removed.length;
    }

    undoBulkDelete() {
      if (!this._lastBulkDeleted) return false;
      this._lastBulkDeleted
        .slice()
        .sort((a, b) => a.index - b.index)
        .forEach(({ task, index }) => {
          const safeIndex = Math.min(index, this.tasks.length);
          this.tasks.splice(safeIndex, 0, task);
        });
      this._lastBulkDeleted = null;
      this._persistTasks();
      this._emit("restore");
      return true;
    }

    /** Move task `fromId` to just before `toId` (or to the end if `toId` is null). */
    reorderTask(fromId, toId) {
      const fromIndex = this.tasks.findIndex((t) => t.id === fromId);
      if (fromIndex === -1) return;
      const [moved] = this.tasks.splice(fromIndex, 1);

      if (toId == null) {
        this.tasks.push(moved);
      } else {
        const toIndex = this.tasks.findIndex((t) => t.id === toId);
        this.tasks.splice(toIndex === -1 ? this.tasks.length : toIndex, 0, moved);
      }
      this._persistTasks();
      this._emit("reorder");
    }

    /** Board drag target: reassigns a task's due date to match the column it was dropped in. */
    moveTaskToColumn(id, column) {
      const task = this.tasks.find((t) => t.id === id);
      if (!task) return;
      const today = Ledger.utils.startOfDay(Date.now());
      const DAY_MS = 24 * 60 * 60 * 1000;
      if (column === "someday") task.dueDate = null;
      else if (column === "today") task.dueDate = today;
      else if (column === "overdue") task.dueDate = today - DAY_MS;
      else if (column === "upcoming") task.dueDate = task.dueDate && task.dueDate > today ? task.dueDate : today + DAY_MS;
      this._persistTasks();
      this._emit("due", task);
    }

    setFilter(filter) {
      if (!["all", "active", "completed"].includes(filter)) return;
      this.filter = filter;
      this._persistFilter();
      this._emit("filter", filter);
    }

    setSearch(query) {
      this.search = query || "";
      this._emit("search", this.search);
    }

    setActiveTag(tag) {
      this.activeTag = this.activeTag === tag ? null : tag;
      this._emit("tagfilter", this.activeTag);
    }

    // ------------------------------------------------------------ backup

    /** Serializes everything needed to fully restore state on another device. */
    exportData() {
      return JSON.stringify(
        {
          version: 4,
          exportedAt: Date.now(),
          tasks: this.tasks,
          capacity: this.capacity,
          completedDays: Array.from(this.completedDays),
        },
        null,
        2
      );
    }

    /** Returns { ok:true, count } or { ok:false, error }. Replaces current state. */
    importData(json) {
      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { ok: false, error: "That file isn't valid JSON." };
      }
      if (!parsed || !Array.isArray(parsed.tasks)) {
        return { ok: false, error: "That file doesn't look like a Daybook backup." };
      }
      this.tasks = parsed.tasks
        .filter((t) => t && typeof t.id === "string" && typeof t.text === "string")
        .map((t) => this._normalizeTask(t));
      if (typeof parsed.capacity === "number" && parsed.capacity > 0) {
        this.capacity = parsed.capacity;
        this._persistCapacity();
      }
      if (Array.isArray(parsed.completedDays)) {
        this.completedDays = new Set(parsed.completedDays);
        this._persistStreak();
      }
      this._persistTasks();
      this._emit("import", { count: this.tasks.length });
      return { ok: true, count: this.tasks.length };
    }
  }

  Store.EFFORT_WEIGHT = EFFORT_WEIGHT;
  return Store;
})();
