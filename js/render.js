/**
 * render.js — the only module allowed to touch the DOM for app content.
 * Pure(ish) functions: given store state, produce/update markup.
 * Never mutates the store — see app.js for the event wiring that does.
 */
window.Ledger = window.Ledger || {};

Ledger.render = (function () {
  "use strict";

  const RING_CIRCUMFERENCE = 2 * Math.PI * 12; // r=12, matches the SVG in index.html

  let els = null;
  let callbacks = null;

  function init(elements, cb) {
    els = elements;
    callbacks = cb;
  }

  // ------------------------------------------------------------- one row

  function buildDueBadge(task) {
    if (!task.dueDate) return null;
    const status = Ledger.utils.dueDateStatus(task.dueDate);
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "due-badge due-" + status;
    badge.textContent = Ledger.utils.formatDueDate(task.dueDate);
    badge.title = "Due date — click to change";
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onEditDue(task.id, task.dueDate);
    });
    return badge;
  }

  function buildTagChips(task) {
    if (!task.tags.length) return null;
    const wrap = document.createElement("span");
    wrap.className = "tag-chips";
    task.tags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.textContent = "#" + tag;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        callbacks.onTagClick(tag);
      });
      wrap.appendChild(chip);
    });
    return wrap;
  }

  function buildRecurrenceBadge(task) {
    if (!task.recurrence) return null;
    const badge = document.createElement("span");
    badge.className = "recur-badge";
    badge.title = "Repeats " + task.recurrence;
    badge.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return badge;
  }

  function buildSubtasks(task) {
    if (!task.subtasks.length) {
      // still offer a lightweight "add subtask" affordance via the row action
      return null;
    }
    const done = task.subtasks.filter((s) => s.completed).length;

    const details = document.createElement("details");
    details.className = "subtask-details";

    const summary = document.createElement("summary");
    summary.className = "subtask-summary";
    summary.textContent = `${done}/${task.subtasks.length} subtasks`;
    details.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "subtask-list";
    task.subtasks.forEach((sub) => {
      const li = document.createElement("li");
      li.className = "subtask-row" + (sub.completed ? " completed" : "");

      const check = document.createElement("button");
      check.type = "button";
      check.className = "subtask-check" + (sub.completed ? " checked" : "");
      check.setAttribute("aria-label", sub.completed ? "Mark subtask not done" : "Mark subtask done");
      check.addEventListener("click", (e) => {
        e.stopPropagation();
        callbacks.onToggleSubtask(task.id, sub.id);
      });

      const label = document.createElement("span");
      label.className = "subtask-label";
      label.textContent = sub.text;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "subtask-delete";
      del.setAttribute("aria-label", "Delete subtask: " + sub.text);
      del.textContent = "×";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        callbacks.onDeleteSubtask(task.id, sub.id);
      });

      li.appendChild(check);
      li.appendChild(label);
      li.appendChild(del);
      list.appendChild(li);
    });
    details.appendChild(list);
    return details;
  }

  function buildRow(task, index, store) {
    const li = document.createElement("li");
    const selectMode = store.isSelectMode();
    const selected = store.isSelected(task.id);
    li.className =
      "task-row" +
      (task.completed ? " completed" : "") +
      (selectMode ? " select-mode" : "") +
      (selected ? " selected" : "");
    li.dataset.id = task.id;
    li.style.setProperty("--i", String(index));

    const selectBox = document.createElement("button");
    selectBox.type = "button";
    selectBox.className = "select-box" + (selected ? " checked" : "");
    selectBox.setAttribute("aria-label", (selected ? "Deselect" : "Select") + " task: " + task.text);
    selectBox.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 12.5L9.5 18L20 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    selectBox.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onToggleSelect(task.id);
    });

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.innerHTML =
      '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="2" r="1.4"/><circle cx="8" cy="2" r="1.4"/><circle cx="2" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="2" cy="14" r="1.4"/><circle cx="8" cy="14" r="1.4"/></svg>';

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check" + (task.completed ? " checked" : "");
    check.setAttribute("aria-label", task.completed ? "Mark as not done" : "Mark as done");
    check.innerHTML =
      '<svg class="check-icon" viewBox="0 0 24 24"><path class="check-path" d="M4 12.5L9.5 18L20 6" /></svg>';
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onToggle(task.id, check);
    });

    const effortBtn = document.createElement("button");
    effortBtn.type = "button";
    effortBtn.className = "effort-dot effort-" + task.effort;
    effortBtn.setAttribute(
      "aria-label",
      "Effort: " + task.effort + ". Click to cycle."
    );
    effortBtn.title = { low: "Low effort", med: "Medium effort", high: "High effort" }[task.effort];
    effortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onCycleEffort(task.id);
    });

    const priorityBtn = document.createElement("button");
    priorityBtn.type = "button";
    priorityBtn.className = "priority-flag priority-p" + task.priority;
    const priorityNames = { 1: "P1 — urgent", 2: "P2 — high", 3: "P3 — normal", 4: "P4 — low" };
    priorityBtn.setAttribute("aria-label", priorityNames[task.priority] + ". Click to cycle.");
    priorityBtn.title = priorityNames[task.priority];
    priorityBtn.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3v18M5 4h13l-3 4 3 4H5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/></svg>';
    priorityBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onCyclePriority(task.id);
    });

    const main = document.createElement("span");
    main.className = "task-main";

    const textWrap = document.createElement("span");
    textWrap.className = "task-text";

    const label = document.createElement("span");
    label.className = "task-label";
    label.textContent = task.text; // textContent only — never render user input as HTML

    const strikeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    strikeSvg.setAttribute("class", "strike-svg");
    strikeSvg.setAttribute("viewBox", "0 0 100 10");
    strikeSvg.setAttribute("preserveAspectRatio", "none");
    const strikePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    strikePath.setAttribute("class", "strike-path");
    strikePath.setAttribute("d", "M0 5 L100 5");
    strikePath.setAttribute("pathLength", "1");
    strikeSvg.appendChild(strikePath);

    textWrap.appendChild(label);
    textWrap.appendChild(strikeSvg);
    main.appendChild(textWrap);

    const meta = document.createElement("span");
    meta.className = "task-meta";
    const dueBadge = buildDueBadge(task);
    if (dueBadge) meta.appendChild(dueBadge);
    const recurBadge = buildRecurrenceBadge(task);
    if (recurBadge) meta.appendChild(recurBadge);
    const chips = buildTagChips(task);
    if (chips) meta.appendChild(chips);
    if (meta.childNodes.length) main.appendChild(meta);

    const subtasks = buildSubtasks(task);
    if (subtasks) main.appendChild(subtasks);

    const actions = document.createElement("span");
    actions.className = "row-actions";

    const addSub = document.createElement("button");
    addSub.type = "button";
    addSub.className = "add-subtask-btn";
    addSub.setAttribute("aria-label", "Add subtask");
    addSub.title = "Add subtask";
    addSub.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    addSub.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onAddSubtask(task.id);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.setAttribute("aria-label", "Delete task: " + task.text);
    del.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    del.addEventListener("click", () => callbacks.onDelete(task.id));

    actions.appendChild(addSub);
    actions.appendChild(del);

    li.appendChild(selectBox);
    li.appendChild(handle);
    li.appendChild(check);
    li.appendChild(priorityBtn);
    li.appendChild(effortBtn);
    li.appendChild(main);
    li.appendChild(actions);

    li.addEventListener("click", (e) => {
      if (!store.isSelectMode()) return;
      // Any other row control (check, effort, delete, tag chip, etc.) already
      // stops propagation, so a click that reaches here is on open row space —
      // treat it the same as tapping the select box.
      callbacks.onToggleSelect(task.id);
    });

    Ledger.dragdrop.attach(li, task.id, callbacks.onReorder);
    Ledger.gestures.attach(li, {
      onComplete: () => callbacks.onToggle(task.id, check),
      onDelete: () => callbacks.onDelete(task.id),
    });

    return li;
  }

  // ------------------------------------------------------------- particles

  function celebrate(checkEl) {
    if (Ledger.utils.prefersReducedMotion()) return;
    const rect = checkEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    // signature: the stamp press + ink ripple/bloom at the point of completion
    checkEl.classList.add("stamping");
    checkEl.addEventListener(
      "animationend",
      () => checkEl.classList.remove("stamping"),
      { once: true }
    );
    const ripple = document.createElement("span");
    ripple.className = "stamp-ripple";
    ripple.style.left = originX + "px";
    ripple.style.top = originY + "px";
    document.body.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });

    const bloom = document.createElement("span");
    bloom.className = "stamp-bloom";
    bloom.style.left = originX + "px";
    bloom.style.top = originY + "px";
    document.body.appendChild(bloom);
    bloom.addEventListener("animationend", () => bloom.remove(), { once: true });

    for (let i = 0; i < 6; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      document.body.appendChild(p);
      p.style.position = "fixed";
      p.style.left = originX + "px";
      p.style.top = originY + "px";

      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
      const dist = 20 + Math.random() * 14;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;

      const anim = p.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          { transform: `translate(${dx - 2}px, ${dy - 2}px) scale(0)`, opacity: 0 },
        ],
        { duration: 480, easing: "cubic-bezier(.22,.68,0,1)" }
      );
      anim.onfinish = () => p.remove();
    }
  }

  // ------------------------------------------------------------- board view

  function buildBoardCard(task) {
    const card = document.createElement("div");
    card.className = "board-card";
    card.dataset.id = task.id;
    card.draggable = true;

    const top = document.createElement("div");
    top.className = "board-card__top";
    const flag = document.createElement("span");
    flag.className = "priority-flag priority-p" + task.priority + " static";
    flag.innerHTML =
      '<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3v18M5 4h13l-3 4 3 4H5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/></svg>';
    top.appendChild(flag);
    const effort = document.createElement("span");
    effort.className = "effort-dot effort-" + task.effort + " static";
    top.appendChild(effort);
    if (task.dueDate) {
      const badge = document.createElement("span");
      badge.className = "due-badge due-" + Ledger.utils.dueDateStatus(task.dueDate) + " static";
      badge.textContent = Ledger.utils.formatDueDate(task.dueDate);
      top.appendChild(badge);
    }
    card.appendChild(top);

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check board-card__check" + (task.completed ? " checked" : "");
    check.setAttribute("aria-label", task.completed ? "Mark as not done" : "Mark as done");
    check.innerHTML =
      '<svg class="check-icon" viewBox="0 0 24 24"><path class="check-path" d="M4 12.5L9.5 18L20 6" /></svg>';
    check.addEventListener("click", () => callbacks.onToggle(task.id, check));

    const text = document.createElement("p");
    text.className = "board-card__text";
    text.textContent = task.text;

    const row = document.createElement("div");
    row.className = "board-card__row";
    row.appendChild(check);
    row.appendChild(text);
    card.appendChild(row);

    if (task.tags.length) {
      const chips = buildTagChips(task);
      if (chips) card.appendChild(chips);
    }

    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", task.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));

    return card;
  }

  const BOARD_COLUMNS = [
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "someday", label: "Someday" },
    { key: "done", label: "Done this week" },
  ];

  function renderBoard(store) {
    if (!els.board) return;
    const cols = store.getBoardColumns();
    els.board.innerHTML = "";
    BOARD_COLUMNS.forEach(({ key, label }) => {
      const list = cols[key] || [];
      const colEl = document.createElement("section");
      colEl.className = "board-col board-col--" + key;
      colEl.dataset.column = key;

      const head = document.createElement("div");
      head.className = "board-col__head";
      head.innerHTML = `<span>${label}</span><span class="board-col__count mono">${list.length}</span>`;
      colEl.appendChild(head);

      const body = document.createElement("div");
      body.className = "board-col__body";
      if (list.length === 0) {
        const empty = document.createElement("p");
        empty.className = "board-col__empty";
        empty.textContent = key === "done" ? "Nothing cleared yet." : "Clear.";
        body.appendChild(empty);
      } else {
        list.forEach((t) => body.appendChild(buildBoardCard(t)));
      }
      colEl.appendChild(body);

      if (key !== "done") {
        body.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          colEl.classList.add("drag-over");
        });
        body.addEventListener("dragleave", () => colEl.classList.remove("drag-over"));
        body.addEventListener("drop", (e) => {
          e.preventDefault();
          colEl.classList.remove("drag-over");
          const id = e.dataTransfer.getData("text/plain");
          if (id) callbacks.onBoardDrop(id, key);
        });
      }

      els.board.appendChild(colEl);
    });
  }

  // ------------------------------------------------------------- heatmap

  function renderHeatmap(store, container) {
    if (!container) return;
    const WEEKS = 10;
    const cells = store.getHeatmap(WEEKS);
    container.innerHTML = "";
    const max = Math.max(1, ...cells.map((c) => c.value));
    cells.forEach((c) => {
      const cell = document.createElement("span");
      let level = 0;
      if (c.value > 0) level = Math.min(4, Math.ceil((c.value / max) * 4));
      cell.className = "heat-cell heat-l" + level;
      const d = new Date(c.date);
      const dateLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
      cell.title = c.value > 0 ? `${dateLabel}: ${c.value} effort cleared` : `${dateLabel}: nothing logged`;
      container.appendChild(cell);
    });
  }

  // ------------------------------------------------------------- day-clear celebration

  function celebrateDayCleared() {
    if (Ledger.utils.prefersReducedMotion()) return;
    const colors = ["var(--accent)", "var(--complete)", "var(--accent-strong)", "var(--text)"];
    const count = 34;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = 45 + Math.random() * 10 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--rot", Math.random() * 360 + "deg");
      p.style.setProperty("--drift", (Math.random() * 160 - 80) + "px");
      p.style.setProperty("--fall-dur", 1100 + Math.random() * 700 + "ms");
      p.style.setProperty("--fall-delay", Math.random() * 120 + "ms");
      document.body.appendChild(p);
      p.addEventListener("animationend", () => p.remove(), { once: true });
    }
  }

  // ------------------------------------------------------------- full render

  function renderList(store) {
    const visible = store.getVisibleTasks();
    els.list.innerHTML = "";
    els.list.classList.toggle("select-mode", store.isSelectMode());
    const frag = document.createDocumentFragment();
    visible.forEach((task, i) => frag.appendChild(buildRow(task, i, store)));
    els.list.appendChild(frag);
    renderSelectionBar(store);

    const counts = store.getCounts();
    const filter = store.getFilter();
    const searching = store.getSearch().trim().length > 0 || !!store.getActiveTag();

    const emptyMessages = {
      all: { title: "Nothing logged yet.", sub: "What's first?" },
      active: { title: "All clear.", sub: "Nothing left to do." },
      completed: { title: "Nothing finished yet.", sub: "Check something off." },
    };
    const isEmpty = visible.length === 0;
    els.empty.classList.toggle("show", isEmpty);
    if (isEmpty) {
      if (searching) {
        els.emptyTitle.textContent = "No matches.";
        els.emptySub.textContent = "Try a different search or tag.";
      } else {
        els.emptyTitle.textContent = emptyMessages[filter].title;
        els.emptySub.textContent = emptyMessages[filter].sub;
      }
    }

    els.count.textContent =
      counts.active === 1 ? "1 task left" : counts.active + " tasks left";
    els.clearBtn.disabled = counts.completed === 0;
    els.nextIndex.textContent = String(counts.total + 1).padStart(2, "0");

    els.filterBtns.forEach((btn) => {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    const overdue = store.getOverdueCount();
    if (els.overdueBadge) {
      els.overdueBadge.textContent = overdue;
      els.overdueBadge.classList.toggle("show", overdue > 0);
    }
  }

  function renderTagFilters(store) {
    if (!els.tagFilters) return;
    const tags = store.getAllTags();
    const active = store.getActiveTag();

    els.tagFilters.innerHTML = "";
    els.tagFilters.classList.toggle("show", tags.length > 0);
    tags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-filter-chip" + (tag === active ? " active" : "");
      chip.textContent = "#" + tag;
      chip.addEventListener("click", () => callbacks.onTagClick(tag));
      els.tagFilters.appendChild(chip);
    });

    // mirror the same tags into the desktop sidebar as a vertical nav list
    if (els.sidebarTagFilters) {
      els.sidebarTagFilters.innerHTML = "";
      if (els.sidebarTagsGroup) els.sidebarTagsGroup.classList.toggle("show", tags.length > 0);
      tags.forEach((tag) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "sidebar-nav-item" + (tag === active ? " active" : "");
        item.textContent = tag;
        item.addEventListener("click", () => callbacks.onTagClick(tag));
        els.sidebarTagFilters.appendChild(item);
      });
    }
  }

  function renderStats(store) {
    els.streakCount.textContent = String(store.getStreak());

    const progress = store.getTodayProgress();
    const offset = RING_CIRCUMFERENCE * (1 - progress.percent / 100);
    els.progressCircle.style.strokeDashoffset = String(offset);
    els.progressLabel.textContent = progress.percent + "%";
    // a 0-length arc still paints a visible dot because of the round
    // line cap — fade the fill out entirely at 0% instead of leaving
    // that stray mark sitting on the ring
    els.progressCircle.style.opacity = progress.percent > 0 ? "1" : "0";

    if (els.sidebarStreakCount) els.sidebarStreakCount.textContent = String(store.getStreak());
    if (els.sidebarProgressCircle) {
      els.sidebarProgressCircle.style.strokeDashoffset = String(offset);
      els.sidebarProgressCircle.style.opacity = progress.percent > 0 ? "1" : "0";
    }
    if (els.sidebarProgressLabel) els.sidebarProgressLabel.textContent = progress.percent + "%";
  }

  // ----------------------------------------------------------- statement
  //
  // Fully editable activity chart: caller picks how many days/weeks to
  // look back (7 / 14 / 30 / 84), which metric to plot (effort or raw
  // entry count), and whether to draw it as bars or a line. Everything
  // reads from the same store.getStatement(range) call — no new state
  // is persisted here, the chosen prefs are saved by app.js.

  function renderStatement(store, els2, opts) {
    const o = Object.assign({ range: 7, type: "bar", metric: "effort" }, opts);
    const s = store.getStatement(o.range);
    const metricKey = o.metric === "count" ? "count" : "effort";
    const values = s.days.map((d) => d[metricKey]);
    const maxVal = Math.max(1, ...values);
    const svg = els2.statementChart;
    const W = 280, H = 78, PAD = 4;
    const n = s.days.length;
    const dense = n > 14; // thin bars / no per-point dots once the range gets busy

    svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";

    const baseline = document.createElementNS(ns, "line");
    baseline.setAttribute("class", "statement-baseline");
    baseline.setAttribute("x1", "0");
    baseline.setAttribute("x2", String(W));
    baseline.setAttribute("y1", String(H));
    baseline.setAttribute("y2", String(H));
    svg.appendChild(baseline);

    if (o.type === "line") {
      const trackHeight = H - PAD;
      const stepX = n > 1 ? W / (n - 1) : 0;
      const points = s.days.map((day, i) => {
        const x = n > 1 ? i * stepX : W / 2;
        const v = day[metricKey];
        const y = H - (v > 0 ? Math.max(3, (v / maxVal) * trackHeight) : 0);
        return { x, y, day };
      });

      const areaPath =
        `M0,${H} ` + points.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + ` L${W},${H} Z`;
      const area = document.createElementNS(ns, "path");
      area.setAttribute("class", "statement-area");
      area.setAttribute("d", areaPath);
      svg.appendChild(area);

      const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
      const line = document.createElementNS(ns, "path");
      line.setAttribute("class", "statement-line");
      line.setAttribute("d", linePath);
      line.setAttribute("fill", "none");
      svg.appendChild(line);

      if (!dense) {
        points.forEach((p) => {
          const dot = document.createElementNS(ns, "circle");
          dot.setAttribute("class", "statement-dot");
          dot.setAttribute("cx", p.x.toFixed(1));
          dot.setAttribute("cy", p.y.toFixed(1));
          dot.setAttribute("r", "3");
          const label = p.day.count === 1 ? "1 entry" : p.day.count + " entries";
          dot.innerHTML = `<title>${label}, ${p.day.effort} effort</title>`;
          svg.appendChild(dot);
        });
      }
    } else {
      const GAP = dense ? 2 : 8;
      const barW = (W - GAP * (n - 1)) / n;
      const trackHeight = H - PAD;

      s.days.forEach((day, i) => {
        const x = i * (barW + GAP);

        const track = document.createElementNS(ns, "rect");
        track.setAttribute("class", "statement-bar-track");
        track.setAttribute("x", String(x));
        track.setAttribute("y", "4");
        track.setAttribute("width", String(barW));
        track.setAttribute("height", String(trackHeight));
        track.setAttribute("rx", dense ? "1.5" : "3");
        svg.appendChild(track);

        const v = day[metricKey];
        const h = v > 0 ? Math.max(3, (v / maxVal) * trackHeight) : 0;
        const bar = document.createElementNS(ns, "rect");
        bar.setAttribute("class", "statement-bar");
        bar.setAttribute("x", String(x));
        bar.setAttribute("y", String(H - h));
        bar.setAttribute("width", String(barW));
        bar.setAttribute("height", String(h));
        bar.setAttribute("rx", dense ? "1.5" : "3");
        bar.style.animationDelay = (i * (dense ? 4 : 14)) + "ms";
        const label = day.count === 1 ? "1 entry" : day.count + " entries";
        bar.innerHTML = `<title>${label}, ${day.effort} effort</title>`;
        svg.appendChild(bar);
      });
    }

    els2.statementDayLabels.innerHTML = "";
    els2.statementDayLabels.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    // Thin out labels on dense ranges so text never collides.
    const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : n <= 31 ? 5 : 1;
    s.days.forEach((day, i) => {
      const span = document.createElement("span");
      span.textContent = i % labelEvery === 0 || i === n - 1 ? day.label : "";
      els2.statementDayLabels.appendChild(span);
    });

    const rangeText = o.range <= 31 ? `${o.range} days` : `${Math.round(o.range / 7)} weeks`;
    if (els2.statementTitle) els2.statementTitle.textContent = "Last " + rangeText;
    if (els2.stmtCountLabel) els2.stmtCountLabel.textContent = `Entries (${o.range <= 31 ? o.range + "d" : Math.round(o.range / 7) + "w"})`;
    if (els2.stmtEffortLabel) els2.stmtEffortLabel.textContent = `Effort (${o.range <= 31 ? o.range + "d" : Math.round(o.range / 7) + "w"})`;

    els2.stmtWeekCount.textContent = String(s.weekCompleted);
    els2.stmtWeekEffort.textContent = String(s.weekEffort);
    els2.stmtStreak.textContent = String(s.currentStreak);
    els2.stmtBestStreak.textContent = String(s.bestStreak);
    els2.stmtTotal.textContent = String(s.totalCompleted);

    els2.statementTags.innerHTML = "";
    s.topTags.forEach(({ tag, count }) => {
      const chip = document.createElement("span");
      chip.className = "statement-tag-chip";
      chip.innerHTML = `#${tag} <b>${count}</b>`;
      els2.statementTags.appendChild(chip);
    });
  }

  /** Six-window "when do you actually get things done" strip, in the statement modal. */
  function renderRhythm(store, container, noteEl) {
    const r = store.getRhythm();
    container.innerHTML = "";
    const max = Math.max(1, ...r.buckets.map((b) => b.count));

    r.buckets.forEach((b) => {
      const col = document.createElement("div");
      col.className = "rhythm-col";
      const bar = document.createElement("div");
      bar.className = "rhythm-bar";
      const pct = b.count === 0 ? 0 : Math.max(6, Math.round((b.count / max) * 100));
      bar.style.height = pct + "%";
      if (r.peak && b.key === r.peak.key && b.count > 0) bar.classList.add("peak");
      bar.innerHTML = `<title>${b.label}: ${b.count} entr${b.count === 1 ? "y" : "ies"} completed</title>`;
      const label = document.createElement("span");
      label.className = "rhythm-label mono";
      label.textContent = b.label.split("–")[0].replace(/[ap]m$/, "");
      col.appendChild(bar);
      col.appendChild(label);
      container.appendChild(col);
    });

    if (noteEl) {
      noteEl.textContent =
        r.total === 0
          ? "Complete a few tasks to see when you tend to get things done."
          : `Most cleared between ${r.peak.label} — ${r.peak.count} of ${r.total} entries.`;
    }
  }

  /** Floating count/actions bar that appears once anything is selected. */
  function renderSelectionBar(store) {
    if (!els.selectionBar) return;
    const count = store.getSelectionCount();
    const active = store.isSelectMode();
    els.selectionBar.classList.toggle("show", active && count > 0);
    if (els.selectionCount) {
      els.selectionCount.textContent = count === 1 ? "1 selected" : count + " selected";
    }
    if (els.selectModeBtn) {
      els.selectModeBtn.classList.toggle("active", active);
      els.selectModeBtn.setAttribute("aria-pressed", String(active));
    }
    els.list.classList.toggle("select-mode", active);
  }

  function renderLoad(store) {
    const load = store.getTodayLoad();
    els.loadFill.style.width = load.percent + "%";
    els.loadFill.classList.toggle("over", load.overCapacity);
    els.loadFill.classList.toggle("near", !load.overCapacity && load.percent >= 75);
    els.loadLabel.textContent = load.used + " / " + load.capacity + " load";
    els.loadBar.setAttribute("aria-valuenow", String(load.percent));
    els.loadBar.parentElement.classList.toggle("over-capacity", load.overCapacity);
  }

  function renderFocus(store) {
    const task = store.getFocusTask();
    els.focusEmpty.classList.toggle("show", !task);
    els.focusCard.classList.toggle("show", !!task);
    if (task) {
      els.focusText.textContent = task.text;
      els.focusEffort.className = "effort-dot effort-" + task.effort;
      els.focusDoneBtn.dataset.id = task.id;
    }
  }

  function renderDate(el) {
    el.textContent = Ledger.utils.formatDate(new Date());
  }

  function all(store) {
    renderList(store);
    renderBoard(store);
    renderTagFilters(store);
    renderStats(store);
    renderLoad(store);
    renderFocus(store);
  }

  return {
    init,
    all,
    renderList,
    renderBoard,
    renderTagFilters,
    renderStats,
    renderLoad,
    renderFocus,
    renderDate,
    renderStatement,
    renderHeatmap,
    renderRhythm,
    renderSelectionBar,
    celebrate,
    celebrateDayCleared,
  };
})();
