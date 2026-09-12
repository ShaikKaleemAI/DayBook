"use strict";
const { resetStorage } = require("./env");
require("../js/utils.js");
require("../js/store.js");
const { describe, it, assertEqual, assertTrue } = require("./tiny-test");

function freshStore() {
  resetStorage();
  return new global.window.Ledger.Store();
}

describe("addTask", () => {
  it("rejects empty text", () => {
    const store = freshStore();
    const r = store.addTask("   ", "med");
    assertEqual(r.ok, false);
    assertEqual(store.getTasks().length, 0);
  });

  it("rejects text over 140 chars", () => {
    const store = freshStore();
    const r = store.addTask("x".repeat(141), "med");
    assertEqual(r.ok, false);
  });

  it("adds a valid task with defaults", () => {
    const store = freshStore();
    const r = store.addTask("Write tests", "high");
    assertEqual(r.ok, true);
    assertEqual(store.getTasks().length, 1);
    assertEqual(store.getTasks()[0].effort, "high");
    assertEqual(store.getTasks()[0].completed, false);
  });

  it("persists to localStorage after adding", () => {
    const store = freshStore();
    store.addTask("Persisted task", "med");
    const raw = global.localStorage.getItem("ledger.tasks.v4");
    assertTrue(raw !== null);
    assertEqual(JSON.parse(raw).length, 1);
  });
});

describe("toggleTask", () => {
  it("marks a task completed and stamps completedAt", () => {
    const store = freshStore();
    const { task } = store.addTask("Ship it", "med");
    store.toggleTask(task.id);
    const updated = store.getTasks().find((t) => t.id === task.id);
    assertEqual(updated.completed, true);
    assertTrue(updated.completedAt !== null);
  });

  it("un-completing clears completedAt", () => {
    const store = freshStore();
    const { task } = store.addTask("Ship it", "med");
    store.toggleTask(task.id);
    store.toggleTask(task.id);
    const updated = store.getTasks().find((t) => t.id === task.id);
    assertEqual(updated.completed, false);
    assertEqual(updated.completedAt, null);
  });

  it("completing a recurring task spawns the next occurrence", () => {
    const store = freshStore();
    const { task } = store.addTask("Standup", "low", { recurrence: "daily" });
    store.toggleTask(task.id);
    assertEqual(store.getTasks().length, 2, "original + spawned next occurrence");
    const spawned = store.getTasks().find((t) => t.id !== task.id);
    assertEqual(spawned.completed, false);
    assertEqual(spawned.recurrence, "daily");
  });

  it("completing a non-recurring task does not spawn anything", () => {
    const store = freshStore();
    const { task } = store.addTask("One-off", "low");
    store.toggleTask(task.id);
    assertEqual(store.getTasks().length, 1);
  });
});

describe("delete + undo", () => {
  it("deleteTask removes the task", () => {
    const store = freshStore();
    const { task } = store.addTask("Temp", "med");
    store.deleteTask(task.id);
    assertEqual(store.getTasks().length, 0);
  });

  it("undoDelete restores it at its original index", () => {
    const store = freshStore();
    store.addTask("Keep A", "med");
    const { task: b } = store.addTask("Delete B", "med");
    store.addTask("Keep C", "med");
    store.deleteTask(b.id);
    assertEqual(store.getTasks().length, 2);
    const ok = store.undoDelete();
    assertEqual(ok, true);
    assertEqual(store.getTasks().length, 3);
    assertEqual(store.getTasks()[1].id, b.id, "restored to its original position");
  });

  it("undoDelete on empty buffer returns false and is a no-op", () => {
    const store = freshStore();
    assertEqual(store.undoDelete(), false);
  });

  it("clearCompleted removes only completed tasks and is undoable", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.addTask("B (stays active)", "med");
    store.toggleTask(a.id);
    const removedCount = store.clearCompleted();
    assertEqual(removedCount, 1);
    assertEqual(store.getTasks().length, 1);
    store.undoClearCompleted();
    assertEqual(store.getTasks().length, 2);
  });
});

describe("multi-select bulk actions", () => {
  it("toggleSelect / clearSelection track selection state without touching tasks", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.setSelectMode(true);
    assertEqual(store.isSelected(a.id), false);
    store.toggleSelect(a.id);
    assertEqual(store.isSelected(a.id), true);
    assertEqual(store.getSelectionCount(), 1);
    store.clearSelection();
    assertEqual(store.getSelectionCount(), 0);
  });

  it("setSelectMode(false) clears any active selection", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.setSelectMode(true);
    store.toggleSelect(a.id);
    store.setSelectMode(false);
    assertEqual(store.getSelectionCount(), 0);
    assertEqual(store.isSelectMode(), false);
  });

  it("bulkComplete marks only selected, not-yet-completed tasks done and exits select mode", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    const { task: b } = store.addTask("B", "med");
    const { task: c } = store.addTask("C (not selected)", "med");
    store.setSelectMode(true);
    store.toggleSelect(a.id);
    store.toggleSelect(b.id);

    const n = store.bulkComplete();
    assertEqual(n, 2);
    assertEqual(store.getTasks().find((t) => t.id === a.id).completed, true);
    assertEqual(store.getTasks().find((t) => t.id === b.id).completed, true);
    assertEqual(store.getTasks().find((t) => t.id === c.id).completed, false);
    assertEqual(store.isSelectMode(), false, "bulk actions exit select mode when done");
  });

  it("bulkComplete skips already-completed tasks and returns 0 if nothing changed", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.toggleTask(a.id); // already completed
    store.setSelectMode(true);
    store.toggleSelect(a.id);
    const n = store.bulkComplete();
    assertEqual(n, 0);
  });

  it("undoBulkComplete restores prior completed/completedAt state exactly", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.setSelectMode(true);
    store.toggleSelect(a.id);
    store.bulkComplete();
    assertEqual(store.getTasks().find((t) => t.id === a.id).completed, true);

    store.undoBulkComplete();
    const restored = store.getTasks().find((t) => t.id === a.id);
    assertEqual(restored.completed, false);
    assertEqual(restored.completedAt, null);
  });

  it("bulkDelete removes only selected tasks, preserves others, and is undoable at original positions", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.addTask("B (stays)", "med");
    const { task: c } = store.addTask("C", "med");
    store.setSelectMode(true);
    store.toggleSelect(a.id);
    store.toggleSelect(c.id);

    const n = store.bulkDelete();
    assertEqual(n, 2);
    assertEqual(store.getTasks().length, 1);
    assertEqual(store.getTasks()[0].text, "B (stays)");

    store.undoBulkDelete();
    assertEqual(store.getTasks().length, 3);
    assertEqual(store.getTasks().map((t) => t.text).join(","), "A,B (stays),C");
  });

  it("bulkDelete with an empty selection is a no-op", () => {
    const store = freshStore();
    store.addTask("A", "med");
    store.setSelectMode(true);
    const n = store.bulkDelete();
    assertEqual(n, 0);
    assertEqual(store.getTasks().length, 1);
  });
});

describe("load / capacity", () => {
  it("getTodayLoad sums effort weight of incomplete tasks only", () => {
    const store = freshStore();
    store.addTask("low", "low"); // 1
    store.addTask("med", "med"); // 2
    const { task: high } = store.addTask("high", "high"); // 3, but will be completed
    store.toggleTask(high.id);
    const load = store.getTodayLoad();
    assertEqual(load.used, 3, "1 (low) + 2 (med), high is completed so excluded");
  });

  it("flags overCapacity once used exceeds capacity", () => {
    const store = freshStore();
    store.setCapacity(2);
    store.addTask("big one", "high"); // weight 3 > capacity 2
    assertEqual(store.getTodayLoad().overCapacity, true);
  });

  it("setCapacity ignores zero/negative/NaN", () => {
    const store = freshStore();
    const before = store.capacity;
    store.setCapacity(0);
    assertEqual(store.capacity, before);
    store.setCapacity(-5);
    assertEqual(store.capacity, before);
    store.setCapacity("not a number");
    assertEqual(store.capacity, before);
  });
});

describe("getRhythm — time-of-day completion pattern", () => {
  it("returns all-zero buckets and no peak when nothing is completed", () => {
    const store = freshStore();
    store.addTask("not done yet", "low");
    const r = store.getRhythm();
    assertEqual(r.total, 0);
    assertEqual(r.peak, null);
    assertEqual(r.buckets.length, 6);
    assertTrue(r.buckets.every((b) => b.count === 0));
  });

  it("buckets completions into the correct 4-hour window and finds the peak", () => {
    const store = freshStore();
    const hours = [9, 9, 14, 14, 14, 20];
    hours.forEach((hour, i) => {
      const { task } = store.addTask("t" + i, "low");
      const t = store.tasks.find((x) => x.id === task.id);
      t.completed = true;
      const d = new Date();
      d.setHours(hour, 0, 0, 0);
      t.completedAt = d.getTime();
    });
    const r = store.getRhythm();
    assertEqual(r.total, 6);
    assertEqual(r.peak.key, "afternoon", "3 of 6 completions fall in the 12-4pm window");
    assertEqual(r.peak.count, 3);
    const morning = r.buckets.find((b) => b.key === "morning");
    assertEqual(morning.count, 2, "the two 9am completions land in the 8am-12pm window");
  });
});

describe("filters, search, and visible tasks", () => {
  it("setFilter only accepts known values", () => {
    const store = freshStore();
    store.setFilter("active");
    assertEqual(store.getFilter(), "active");
    store.setFilter("bogus");
    assertEqual(store.getFilter(), "active", "invalid filter is ignored");
  });

  it("getVisibleTasks respects the active/completed filter", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.addTask("B", "med");
    store.toggleTask(a.id);

    store.setFilter("active");
    assertEqual(store.getVisibleTasks().length, 1);

    store.setFilter("completed");
    assertEqual(store.getVisibleTasks().length, 1);

    store.setFilter("all");
    assertEqual(store.getVisibleTasks().length, 2);
  });

  it("search filters by text, case-insensitively", () => {
    const store = freshStore();
    store.addTask("Buy oat milk", "med");
    store.addTask("Call the dentist", "med");
    store.setSearch("MILK");
    assertEqual(store.getVisibleTasks().length, 1);
  });
});

describe("export / import round-trip", () => {
  it("importData rejects invalid JSON", () => {
    const store = freshStore();
    const r = store.importData("{not json");
    assertEqual(r.ok, false);
  });

  it("importData rejects a payload without a tasks array", () => {
    const store = freshStore();
    const r = store.importData(JSON.stringify({ hello: "world" }));
    assertEqual(r.ok, false);
  });

  it("exportData -> importData round-trips task count and capacity", () => {
    const store = freshStore();
    store.addTask("A", "low");
    store.addTask("B", "high");
    store.setCapacity(12);
    const dump = store.exportData();

    const fresh = freshStore();
    const r = fresh.importData(dump);
    assertEqual(r.ok, true);
    assertEqual(r.count, 2);
    assertEqual(fresh.capacity, 12);
  });
});

describe("reorderTask", () => {
  it("moves a task before another by id", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.addTask("B", "med");
    const { task: c } = store.addTask("C", "med");
    store.reorderTask(c.id, a.id); // move C before A
    const order = store.getTasks().map((t) => t.text);
    assertEqual(order.join(","), "C,A,B");
  });

  it("moves a task to the end when toId is null", () => {
    const store = freshStore();
    const { task: a } = store.addTask("A", "med");
    store.addTask("B", "med");
    store.reorderTask(a.id, null);
    const order = store.getTasks().map((t) => t.text);
    assertEqual(order.join(","), "B,A");
  });
});

module.exports = {};
