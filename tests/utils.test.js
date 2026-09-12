"use strict";
require("./env");
require("../js/utils.js");
const { describe, it, assertEqual, assertTrue } = require("./tiny-test");
const utils = global.window.Ledger.utils;

describe("quick-add parsing", () => {
  it("parses plain text with no modifiers, leaving effort unset for the caller to default", () => {
    // parseQuickAdd intentionally returns effort: null when no "!" is
    // present — app.js applies its own default via `parsed.effort || "med"`.
    const r = utils.parseQuickAdd("Buy milk");
    assertEqual(r.text, "Buy milk");
    assertEqual(r.effort, null);
    assertEqual(r.dueDate, null);
    assertEqual(r.tags.length, 0);
  });

  it("parses effort shorthand !/!!/!!!", () => {
    assertEqual(utils.parseQuickAdd("Small task !").effort, "low");
    assertEqual(utils.parseQuickAdd("Medium task !!").effort, "med");
    assertEqual(utils.parseQuickAdd("Big task !!!").effort, "high");
  });

  it("parses #tags and strips them from text", () => {
    const r = utils.parseQuickAdd("Ship the deck #work #urgent");
    assertEqual(r.tags.length, 2);
    assertTrue(r.tags.includes("work"));
    assertTrue(r.tags.includes("urgent"));
    assertTrue(!r.text.includes("#"));
  });

  it("parses @today as a due date", () => {
    const r = utils.parseQuickAdd("Ship the deck @today");
    assertTrue(r.dueDate !== null);
    assertEqual(utils.dueDateStatus(r.dueDate), "today");
  });

  it("parses recurrence tokens", () => {
    assertEqual(utils.parseQuickAdd("Standup *daily").recurrence, "daily");
    assertEqual(utils.parseQuickAdd("Review *weekly").recurrence, "weekly");
  });

  it("combines effort, due date, tag, and recurrence in one line", () => {
    const r = utils.parseQuickAdd("Ship the deck !!! @today #work *weekly");
    assertEqual(r.effort, "high");
    assertEqual(r.recurrence, "weekly");
    assertTrue(r.tags.includes("work"));
    assertTrue(r.dueDate !== null);
    assertEqual(r.text, "Ship the deck");
  });
});

describe("due date formatting", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("labels today correctly", () => {
    assertEqual(utils.formatDueDate(Date.now()), "Today");
  });

  it("labels a past timestamp as Overdue", () => {
    assertEqual(utils.formatDueDate(Date.now() - 3 * DAY_MS), "Overdue");
  });

  it("labels tomorrow correctly", () => {
    assertEqual(utils.formatDueDate(Date.now() + DAY_MS), "Tomorrow");
  });

  it("dueDateStatus matches formatDueDate for overdue/today", () => {
    assertEqual(utils.dueDateStatus(Date.now() - DAY_MS), "overdue");
    assertEqual(utils.dueDateStatus(Date.now()), "today");
    assertEqual(utils.dueDateStatus(Date.now() + 5 * DAY_MS), "upcoming");
  });
});

describe("misc helpers", () => {
  it("clamp bounds a value to [min, max]", () => {
    assertEqual(utils.clamp(15, 0, 10), 10);
    assertEqual(utils.clamp(-5, 0, 10), 0);
    assertEqual(utils.clamp(5, 0, 10), 5);
  });

  it("cycleEffort rotates low -> med -> high -> low", () => {
    assertEqual(utils.cycleEffort("low"), "med");
    assertEqual(utils.cycleEffort("med"), "high");
    assertEqual(utils.cycleEffort("high"), "low");
  });

  it("uid generates unique-looking ids", () => {
    const a = utils.uid();
    const b = utils.uid();
    assertTrue(a !== b, "two calls should not collide");
  });
});

module.exports = {};
