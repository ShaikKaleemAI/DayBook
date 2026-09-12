/**
 * app.js — composition root. Grabs DOM references, instantiates the store,
 * wires user events to store mutations, and re-renders on every store change.
 * This is the only file that knows about all the other modules at once.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const els = {
      form: document.getElementById("add-form"),
      input: document.getElementById("task-input"),
      nextIndex: document.getElementById("next-index"),
      error: document.getElementById("input-error"),
      list: document.getElementById("task-list"),
      board: document.getElementById("board-view"),
      viewBtns: document.querySelectorAll(".view-switch-btn"),
      viewIndicator: document.getElementById("view-switch-indicator"),
      heatmap: document.getElementById("statement-heatmap"),
      empty: document.getElementById("empty-state"),
      emptyTitle: document.getElementById("empty-title"),
      emptySub: document.getElementById("empty-sub"),
      count: document.getElementById("count-label"),
      filterBtns: document.querySelectorAll(".filter-btn"),
      clearBtn: document.getElementById("clear-completed"),
      selectModeBtn: document.getElementById("select-mode-btn"),
      selectionBar: document.getElementById("selection-bar"),
      selectionCount: document.getElementById("selection-count"),
      selectionComplete: document.getElementById("selection-complete"),
      selectionDelete: document.getElementById("selection-delete"),
      selectionCancel: document.getElementById("selection-cancel"),
      themeToggle: document.getElementById("theme-toggle"),
      todayDate: document.getElementById("today-date"),
      streakCount: document.getElementById("streak-count"),
      progressCircle: document.getElementById("progress-circle"),
      progressLabel: document.getElementById("progress-label"),
      shortcutsBtn: document.getElementById("shortcuts-btn"),
      shortcutsBackdrop: document.getElementById("shortcuts-backdrop"),
      toastRegion: document.getElementById("toast-region"),
      loadBar: document.getElementById("load-bar"),
      loadFill: document.getElementById("load-fill"),
      loadLabel: document.getElementById("load-label"),
      focusBtn: document.getElementById("focus-btn"),
      focusOverlay: document.getElementById("focus-overlay"),
      focusExitBtn: document.getElementById("focus-exit"),
      focusCard: document.getElementById("focus-card"),
      focusEmpty: document.getElementById("focus-empty"),
      focusText: document.getElementById("focus-text"),
      focusEffort: document.getElementById("focus-effort"),
      focusDoneBtn: document.getElementById("focus-done"),
      focusSkipBtn: document.getElementById("focus-skip"),
      focusTimerLabel: document.getElementById("focus-timer-label"),
      focusTimerBtn: document.getElementById("focus-timer-btn"),
      focusRingFill: document.getElementById("focus-ring-fill"),
      paletteBackdrop: document.getElementById("palette-backdrop"),
      paletteInput: document.getElementById("palette-input"),
      paletteList: document.getElementById("palette-list"),
      paletteBtn: document.getElementById("palette-btn"),
      searchInput: document.getElementById("search-input"),
      tagFilters: document.getElementById("tag-filters"),
      overdueBadge: document.getElementById("overdue-badge"),
      importFile: document.getElementById("import-file"),
      exportBtn: document.getElementById("export-btn"),
      statementBtn: document.getElementById("statement-btn"),
      statementBackdrop: document.getElementById("statement-backdrop"),
      statementClose: document.getElementById("statement-close"),
      statementChart: document.getElementById("statement-chart"),
      statementDayLabels: document.getElementById("statement-day-labels"),
      statementTags: document.getElementById("statement-tags"),
      statementTitle: document.getElementById("statement-title"),
      stmtWeekCount: document.getElementById("stmt-week-count"),
      stmtWeekEffort: document.getElementById("stmt-week-effort"),
      stmtStreak: document.getElementById("stmt-streak"),
      stmtBestStreak: document.getElementById("stmt-best-streak"),
      stmtTotal: document.getElementById("stmt-total"),
      stmtCountLabel: document.getElementById("stmt-count-label"),
      stmtEffortLabel: document.getElementById("stmt-effort-label"),
      statementRhythm: document.getElementById("statement-rhythm"),
      stmtRhythmNote: document.getElementById("stmt-rhythm-note"),
      chartRangeGroup: document.getElementById("chart-range"),
      chartTypeGroup: document.getElementById("chart-type"),
      chartMetricGroup: document.querySelector(".chip-group--metric"),

      // desktop sidebar (see css/sidebar.css — hidden below 1024px)
      sidebarTagFilters: document.getElementById("sidebar-tag-filters"),
      sidebarTagsGroup: document.getElementById("sidebar-tags-group"),
      sidebarStreakCount: document.getElementById("sb-streak-count"),
      sidebarProgressCircle: document.getElementById("sb-progress-circle"),
      sidebarProgressLabel: document.getElementById("sb-progress-label"),
    };

    const store = new Ledger.Store();
    let errorTimeout = null;

    // ---- editable activity chart: range / type / metric, remembered ----
    // The statement always opens on the plain 7-day view — simple and
    // predictable — but you can still switch range/type/metric with the
    // chips while it's open; that choice just isn't remembered between
    // opens, so it never surprises you with a stale, possibly-empty range.
    const chartPrefs = { range: 7, type: "bar", metric: "effort" };
    function syncChartChips() {
      els.chartRangeGroup.querySelectorAll(".chip").forEach((btn) => {
        const active = Number(btn.dataset.range) === chartPrefs.range;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
      });
      els.chartTypeGroup.querySelectorAll(".chip").forEach((btn) => {
        const active = btn.dataset.type === chartPrefs.type;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
      });
      els.chartMetricGroup.querySelectorAll(".chip").forEach((btn) => {
        const active = btn.dataset.metric === chartPrefs.metric;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
      });
    }
    function renderStatementNow() {
      Ledger.render.renderStatement(store, els, chartPrefs);
      Ledger.render.renderHeatmap(store, els.heatmap);
      Ledger.render.renderRhythm(store, els.statementRhythm, els.stmtRhythmNote);
    }
    els.chartRangeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      chartPrefs.range = Number(btn.dataset.range);
      syncChartChips();
      renderStatementNow();
    });
    els.chartTypeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      chartPrefs.type = btn.dataset.type;
      syncChartChips();
      renderStatementNow();
    });
    els.chartMetricGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      chartPrefs.metric = btn.dataset.metric;
      syncChartChips();
      renderStatementNow();
    });

    Ledger.toast.init(els.toastRegion);
    Ledger.theme.init(els.themeToggle);
    Ledger.render.init(els, {
      onToggle: handleToggle,
      onDelete: handleDelete,
      onReorder: handleReorder,
      onCycleEffort: handleCycleEffort,
      onCyclePriority: handleCyclePriority,
      onTagClick: (tag) => store.setActiveTag(tag),
      onEditDue: handleEditDue,
      onAddSubtask: handleAddSubtask,
      onToggleSubtask: (taskId, subId) => store.toggleSubtask(taskId, subId),
      onDeleteSubtask: (taskId, subId) => store.deleteSubtask(taskId, subId),
      onBoardDrop: (id, column) => store.moveTaskToColumn(id, column),
      onToggleSelect: (id) => store.toggleSelect(id),
    });
    Ledger.shortcuts.init({
      input: els.input,
      backdrop: els.shortcutsBackdrop,
      shortcutsBtn: els.shortcutsBtn,
      onToggleTheme: Ledger.theme.toggle,
      onSetFilter: (f) => store.setFilter(f),
      onUndo: () => {
        if (store.undoDelete()) {
          Ledger.toast.show({ message: "Restored.", duration: 2000 });
        }
      },
      onOpenPalette: () => Ledger.palette.open(),
      onToggleFocus: toggleFocusMode,
    });

    Ledger.palette.init(
      { backdrop: els.paletteBackdrop, input: els.paletteInput, list: els.paletteList },
      buildPaletteActions()
    );

    function buildPaletteActions() {
      return [
        { label: "Focus on next task", keywords: "focus zen mode start", icon: "◎", hint: "F", run: () => enterFocusMode() },
        { label: "Show all tasks", keywords: "filter all", icon: "≡", hint: "1", run: () => store.setFilter("all") },
        { label: "Show active tasks", keywords: "filter active pending", icon: "○", hint: "2", run: () => store.setFilter("active") },
        { label: "Show completed tasks", keywords: "filter done completed", icon: "✓", hint: "3", run: () => store.setFilter("completed") },
        { label: "Clear completed tasks", keywords: "clean sweep delete done", icon: "⌫", run: () => els.clearBtn.click() },
        { label: "Toggle theme (ledger / paper)", keywords: "dark light night day theme", icon: "◐", hint: "T", run: () => Ledger.theme.toggle() },
        { label: "Undo last delete", keywords: "restore undo", icon: "↺", hint: "⌘Z", run: () => store.undoDelete() },
        { label: "Set today's capacity", keywords: "load budget capacity effort limit", icon: "▤", run: () => promptCapacity() },
        { label: "Search tasks", keywords: "find filter search", icon: "⌕", hint: "/", run: () => els.searchInput.focus() },
        { label: "Export backup (JSON)", keywords: "export backup save download data", icon: "⇩", run: () => exportBackup() },
        { label: "Import backup (JSON)", keywords: "import restore upload data", icon: "⇧", run: () => els.importFile.click() },
        { label: "Open activity statement", keywords: "stats statement summary chart week report", icon: "▥", hint: "S", run: () => openStatement() },
        { label: "Switch to list view", keywords: "view list rows", icon: "≣", run: () => setView("list") },
        { label: "Switch to board view", keywords: "view board kanban columns", icon: "▦", hint: "B", run: () => setView("board") },
        { label: "Select multiple tasks", keywords: "bulk select multi multiple", icon: "☑", hint: "X", run: () => store.toggleSelectMode() },
        { label: "Show keyboard shortcuts", keywords: "help keys shortcuts", icon: "?", hint: "?", run: () => els.shortcutsBtn.click() },
      ];
    }

    const statementTrap = Ledger.utils.trapFocus(els.statementBackdrop.querySelector(".modal"));
    function openStatement() {
      chartPrefs.range = 7;
      chartPrefs.type = "bar";
      chartPrefs.metric = "effort";
      syncChartChips();
      renderStatementNow();
      els.statementBackdrop.classList.add("show");
      statementTrap.activate();
    }
    function closeStatement() {
      els.statementBackdrop.classList.remove("show");
      statementTrap.deactivate();
    }
    els.statementBtn.addEventListener("click", openStatement);
    els.statementClose.addEventListener("click", closeStatement);
    els.statementBackdrop.addEventListener("click", (e) => {
      if (e.target === els.statementBackdrop) closeStatement();
    });

    function promptCapacity() {
      const current = store.getTodayLoad().capacity;
      const next = window.prompt("Set today's load capacity (effort points):", String(current));
      if (next && Number(next) > 0) {
        store.setCapacity(Number(next));
        Ledger.toast.show({ message: "Capacity updated.", duration: 2000 });
      }
    }

    els.paletteBtn.addEventListener("click", () => Ledger.palette.open());

    // ---------------------------------------------------- desktop sidebar
    // The sidebar's tool buttons proxy straight to the header's originals
    // instead of re-implementing any logic — one source of truth for what
    // each action does, two places you can trigger it from.
    Ledger.render.renderDate(document.getElementById("sb-today-date"));
    const sbQuickAdd = document.getElementById("sb-quickadd-btn");
    if (sbQuickAdd) sbQuickAdd.addEventListener("click", () => els.input.focus());

    [
      ["sb-focus-btn", els.focusBtn],
      ["sb-statement-btn", els.statementBtn],
      ["sb-palette-btn", els.paletteBtn],
      ["sb-shortcuts-btn", els.shortcutsBtn],
      ["sb-export-btn", els.exportBtn],
    ].forEach(([sbId, target]) => {
      const btn = document.getElementById(sbId);
      if (btn && target) btn.addEventListener("click", () => target.click());
    });

    const sbThemeToggle = document.getElementById("sb-theme-toggle");
    if (sbThemeToggle) sbThemeToggle.addEventListener("click", () => Ledger.theme.toggle());

    const sbImportFile = document.getElementById("sb-import-file");
    if (sbImportFile) {
      sbImportFile.addEventListener("change", () => {
        const file = sbImportFile.files && sbImportFile.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = store.importData(String(reader.result));
          if (result.ok) {
            Ledger.toast.show({ message: `Imported ${result.count} tasks.`, duration: 2400 });
          } else {
            Ledger.toast.show({ message: result.error, duration: 3200 });
          }
        };
        reader.readAsText(file);
        sbImportFile.value = "";
      });
    }

    // Sticky header now carries its own opaque background (fix for the
    // header/search-bar overlap while scrolling). This just adds a subtle
    // shadow once real scrolling has happened, so the floating header reads
    // as "above" the content instead of a flat pinned bar.
    const appHeaderEl = document.getElementById("app-header");
    if (appHeaderEl) {
      let scrollTicking = false;
      window.addEventListener(
        "scroll",
        () => {
          if (scrollTicking) return;
          scrollTicking = true;
          requestAnimationFrame(() => {
            appHeaderEl.classList.toggle("is-scrolled", window.scrollY > 4);
            scrollTicking = false;
          });
        },
        { passive: true }
      );
    }

    store.addEventListener("change", (e) => {
      Ledger.render.all(store);
      if (e.detail.type === "toggle" && e.detail.payload && e.detail.payload.completed) {
        const rowEl = els.list.querySelector(
          `.task-row[data-id="${cssEscape(e.detail.payload.id)}"] .check`
        );
        if (rowEl) Ledger.render.celebrate(rowEl);
        if (store.isTodayCleared()) {
          Ledger.render.celebrateDayCleared();
          Ledger.toast.show({ message: "Today's ledger is balanced. Nicely done.", duration: 3000 });
        }
      }
      if (els.focusOverlay.classList.contains("show")) {
        Ledger.render.renderFocus(store);
      }
      if (els.statementBackdrop.classList.contains("show")) {
        renderStatementNow();
      }
    });

    function cssEscape(id) {
      return window.CSS && CSS.escape ? CSS.escape(id) : id;
    }

    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const parsed = Ledger.utils.parseQuickAdd(els.input.value);
      const result = store.addTask(parsed.text, parsed.effort || "med", {
        tags: parsed.tags,
        dueDate: parsed.dueDate,
        recurrence: parsed.recurrence,
        priority: parsed.priority || 4,
      });
      if (!result.ok) {
        showError(result.error);
        shakeInput();
        return;
      }
      els.input.value = "";
      clearError();
    });

    els.input.addEventListener("input", clearError);

    function showError(message) {
      els.error.textContent = message;
      els.error.classList.add("show");
      clearTimeout(errorTimeout);
      errorTimeout = setTimeout(clearError, 2400);
    }
    function clearError() {
      els.error.classList.remove("show");
    }
    function shakeInput() {
      els.form.classList.remove("shake");
      void els.form.offsetWidth;
      els.form.classList.add("shake");
    }

    function handleToggle(id) {
      store.toggleTask(id);
    }

    function handleCycleEffort(id) {
      const task = store.getTasks().find((t) => t.id === id);
      if (!task) return;
      store.setEffort(id, Ledger.utils.cycleEffort(task.effort));
    }

    function handleCyclePriority(id) {
      const task = store.getTasks().find((t) => t.id === id);
      if (!task) return;
      const next = task.priority === 1 ? 4 : task.priority - 1;
      store.setPriority(id, next);
    }

    function handleEditDue(id, currentTs) {
      const current = currentTs ? new Date(currentTs).toISOString().slice(0, 10) : "";
      const next = window.prompt("Due date (YYYY-MM-DD), or blank to clear:", current);
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) {
        store.setDueDate(id, null);
        return;
      }
      const ts = Ledger.utils.startOfDay(new Date(trimmed + "T00:00:00").getTime());
      if (!isNaN(ts)) store.setDueDate(id, ts);
    }

    function handleAddSubtask(taskId) {
      const text = window.prompt("Subtask:");
      if (text && text.trim()) store.addSubtask(taskId, text.trim());
    }

    function handleDelete(id) {
      const row = els.list.querySelector(`.task-row[data-id="${cssEscape(id)}"]`);

      const commit = () => {
        store.deleteTask(id);
        Ledger.toast.show({
          message: "Task deleted.",
          actionLabel: "Undo",
          onAction: () => store.undoDelete(),
        });
      };

      if (row) {
        row.classList.add("exiting");
        row.addEventListener("animationend", commit, { once: true });
        setTimeout(() => {
          if (store.getTasks().some((t) => t.id === id)) commit();
        }, 320);
      } else {
        commit();
      }
    }

    function handleReorder(fromId, toId) {
      store.reorderTask(fromId, toId);
    }

    els.filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => store.setFilter(btn.dataset.filter));
    });

    // ------------------------------------------------------------ view switch

    function setView(view) {
      document.body.dataset.view = view;
      try {
        localStorage.setItem("ledger.view.v1", view);
      } catch {
        /* ignore */
      }
      els.viewBtns.forEach((btn) => {
        const active = btn.dataset.view === view;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", String(active));
        if (active && els.viewIndicator) {
          els.viewIndicator.style.width = btn.offsetWidth + "px";
          els.viewIndicator.style.transform = `translateX(${btn.offsetLeft}px)`;
        }
      });
      if (view === "board") Ledger.render.renderBoard(store);
    }
    els.viewBtns.forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });
    window.addEventListener("resize", () => setView(document.body.dataset.view || "list"));
    let savedView = "list";
    try {
      savedView = localStorage.getItem("ledger.view.v1") || "list";
    } catch {
      /* ignore */
    }
    setView(savedView);

    els.clearBtn.addEventListener("click", () => {
      const n = store.clearCompleted();
      if (n > 0) {
        Ledger.toast.show({
          message: n === 1 ? "1 task cleared." : n + " tasks cleared.",
          actionLabel: "Undo",
          onAction: () => store.undoClearCompleted(),
        });
      }
    });

    // ------------------------------------------------------------ bulk select

    els.selectModeBtn.addEventListener("click", () => store.toggleSelectMode());
    els.selectionCancel.addEventListener("click", () => store.setSelectMode(false));

    els.selectionComplete.addEventListener("click", () => {
      const n = store.bulkComplete();
      if (n > 0) {
        Ledger.toast.show({
          message: n === 1 ? "1 task completed." : n + " tasks completed.",
          actionLabel: "Undo",
          onAction: () => store.undoBulkComplete(),
        });
      }
    });

    els.selectionDelete.addEventListener("click", () => {
      const n = store.bulkDelete();
      if (n > 0) {
        Ledger.toast.show({
          message: n === 1 ? "1 task deleted." : n + " tasks deleted.",
          actionLabel: "Undo",
          onAction: () => store.undoBulkDelete(),
        });
      }
    });

    // ------------------------------------------------------------ search

    let searchDebounce = null;
    els.searchInput.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => store.setSearch(els.searchInput.value), 120);
    });
    els.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        els.searchInput.value = "";
        store.setSearch("");
        els.searchInput.blur();
      }
    });

    // ------------------------------------------------------------ backup

    function exportBackup() {
      const data = store.exportData();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `ledger-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Ledger.toast.show({ message: "Backup downloaded.", duration: 2200 });
    }

    els.exportBtn.addEventListener("click", exportBackup);

    els.importFile.addEventListener("change", () => {
      const file = els.importFile.files && els.importFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = store.importData(String(reader.result));
        if (result.ok) {
          Ledger.toast.show({ message: `Imported ${result.count} tasks.`, duration: 2400 });
        } else {
          Ledger.toast.show({ message: result.error, duration: 3200 });
        }
      };
      reader.readAsText(file);
      els.importFile.value = "";
    });

    // ------------------------------------------------------------ focus mode

    let timerInterval = null;
    let timerSecondsLeft = 25 * 60;
    let timerRunning = false;
    const TIMER_TOTAL = 25 * 60;

    const focusTrap = Ledger.utils.trapFocus(els.focusOverlay);
    function enterFocusMode() {
      Ledger.render.renderFocus(store);
      els.focusOverlay.classList.add("show");
      resetTimer();
      focusTrap.activate();
    }
    function exitFocusMode() {
      els.focusOverlay.classList.remove("show");
      pauseTimer();
      focusTrap.deactivate();
    }
    function toggleFocusMode() {
      els.focusOverlay.classList.contains("show") ? exitFocusMode() : enterFocusMode();
    }

    els.focusBtn.addEventListener("click", enterFocusMode);
    els.focusExitBtn.addEventListener("click", exitFocusMode);

    els.focusDoneBtn.addEventListener("click", () => {
      const id = els.focusDoneBtn.dataset.id;
      if (!id) return;
      store.toggleTask(id);
      const rowEl = els.list.querySelector(`.task-row[data-id="${cssEscape(id)}"] .check`);
      if (rowEl) Ledger.render.celebrate(rowEl);
      resetTimer();
    });

    els.focusSkipBtn.addEventListener("click", () => {
      const id = els.focusDoneBtn.dataset.id;
      if (!id) return;
      store.reorderTask(id, null);
      Ledger.render.renderFocus(store);
      resetTimer();
    });

    function resetTimer() {
      pauseTimer();
      timerSecondsLeft = TIMER_TOTAL;
      paintTimer();
    }
    function pauseTimer() {
      clearInterval(timerInterval);
      timerInterval = null;
      timerRunning = false;
      els.focusTimerBtn.textContent = "Start focus timer";
    }
    function startTimer() {
      if (window.Notification && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      timerRunning = true;
      els.focusTimerBtn.textContent = "Pause";
      timerInterval = setInterval(() => {
        timerSecondsLeft -= 1;
        if (timerSecondsLeft <= 0) {
          timerSecondsLeft = 0;
          pauseTimer();
          Ledger.toast.show({ message: "Focus session complete.", duration: 3000 });
          if (Notification && Notification.permission === "granted") {
            new Notification("Focus session complete", { body: "Time to check in on your task." });
          }
        }
        paintTimer();
      }, 1000);
    }
    function paintTimer() {
      const m = String(Math.floor(timerSecondsLeft / 60)).padStart(2, "0");
      const s = String(timerSecondsLeft % 60).padStart(2, "0");
      els.focusTimerLabel.textContent = `${m}:${s}`;
      const frac = 1 - timerSecondsLeft / TIMER_TOTAL;
      els.focusRingFill.style.strokeDashoffset = String(2 * Math.PI * 54 * (1 - frac));
      // same round-linecap-at-zero-length artifact as the header progress
      // ring — a stray dot sits on the circle before the timer has moved
      els.focusRingFill.style.opacity = frac > 0 ? "1" : "0";
    }
    els.focusTimerBtn.addEventListener("click", () => {
      timerRunning ? pauseTimer() : startTimer();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.focusOverlay.classList.contains("show")) exitFocusMode();
      if (e.key === "Escape" && els.statementBackdrop.classList.contains("show")) closeStatement();
      if (e.key === "Escape" && store.isSelectMode()) store.setSelectMode(false);
      if (e.key === "/" && document.activeElement !== els.input && document.activeElement !== els.searchInput) {
        e.preventDefault();
        els.searchInput.focus();
      }
      const isTyping =
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.isContentEditable);
      if (!isTyping && e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        els.statementBackdrop.classList.contains("show") ? closeStatement() : openStatement();
      }
      if (!isTyping && e.key.toLowerCase() === "b" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setView(document.body.dataset.view === "board" ? "list" : "board");
      }
      if (!isTyping && e.key.toLowerCase() === "x" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        store.toggleSelectMode();
      }
    });

    // -------------------------------------------------------- installability

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {
          /* offline support is a bonus, not a requirement */
        });
      });
    }

    Ledger.render.renderDate(els.todayDate);
    Ledger.render.all(store);
    els.input.focus();
  });
})();
