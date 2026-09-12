/**
 * palette.js — a Linear-style command palette (⌘/Ctrl K).
 * A flat, fuzzy-searchable list of actions. No DOM ownership outside its
 * own modal; it calls back into app.js-provided handlers to do real work.
 */
window.Ledger = window.Ledger || {};

Ledger.palette = (function () {
  "use strict";

  let els = null;
  let actions = [];
  let filtered = [];
  let activeIndex = 0;
  let lastFocused = null;

  function init(elements, actionList) {
    els = elements;
    actions = actionList;

    els.input.addEventListener("input", () => {
      renderResults(els.input.value);
    });

    els.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        runActive();
      } else if (e.key === "Escape") {
        close();
      } else if (e.key === "Tab") {
        // The palette input is the only focusable control by design —
        // arrow keys drive list navigation — so Tab would otherwise leak
        // focus to whatever sits behind the backdrop. Keep it contained.
        e.preventDefault();
      }
    });

    els.backdrop.addEventListener("click", (e) => {
      if (e.target === els.backdrop) close();
    });

    els.list.addEventListener("click", (e) => {
      const row = e.target.closest("[data-idx]");
      if (!row) return;
      activeIndex = Number(row.dataset.idx);
      runActive();
    });
  }

  function score(query, action) {
    const q = query.trim().toLowerCase();
    if (!q) return 1;
    const hay = (action.label + " " + (action.keywords || "")).toLowerCase();
    if (hay.includes(q)) return hay.startsWith(q) ? 3 : 2;
    // loose subsequence match
    let qi = 0;
    for (let i = 0; i < hay.length && qi < q.length; i++) {
      if (hay[i] === q[qi]) qi++;
    }
    return qi === q.length ? 1 : 0;
  }

  function renderResults(query) {
    filtered = actions
      .map((a) => ({ a, s: score(query, a) }))
      .filter((r) => r.s > 0)
      .sort((r1, r2) => r2.s - r1.s)
      .map((r) => r.a);

    activeIndex = 0;
    els.list.innerHTML = "";
    if (filtered.length === 0) {
      els.list.innerHTML = '<li class="palette-empty">No matching commands.</li>';
      return;
    }
    filtered.forEach((action, i) => {
      const li = document.createElement("li");
      li.className = "palette-row" + (i === 0 ? " active" : "");
      li.dataset.idx = String(i);
      li.innerHTML =
        '<span class="palette-icon" aria-hidden="true">' + (action.icon || "→") + "</span>" +
        '<span class="palette-label">' + action.label + "</span>" +
        (action.hint ? '<kbd class="palette-hint">' + action.hint + "</kbd>" : "");
      els.list.appendChild(li);
    });
  }

  function move(delta) {
    if (filtered.length === 0) return;
    activeIndex = (activeIndex + delta + filtered.length) % filtered.length;
    [...els.list.children].forEach((row, i) => row.classList.toggle("active", i === activeIndex));
    const activeRow = els.list.children[activeIndex];
    if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
  }

  function runActive() {
    const action = filtered[activeIndex];
    if (!action) return;
    close();
    action.run();
  }

  function open() {
    lastFocused = document.activeElement;
    els.backdrop.classList.add("show");
    els.input.value = "";
    renderResults("");
    requestAnimationFrame(() => els.input.focus());
  }

  function close() {
    els.backdrop.classList.remove("show");
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  function isOpen() {
    return els.backdrop.classList.contains("show");
  }

  return { init, open, close, isOpen };
})();
