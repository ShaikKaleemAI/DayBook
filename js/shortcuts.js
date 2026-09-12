/**
 * shortcuts.js — global keyboard shortcuts + the "?" help panel.
 *
 *   Cmd/Ctrl K   open command palette
 *   N            focus quick add
 *   F            enter/exit Focus Mode
 *   1 / 2 / 3    switch filter (All / Active / Done)
 *   T            toggle theme
 *   Cmd/Ctrl Z   undo last delete
 *   ?            open/close shortcuts panel
 *   Esc          close panel / palette / blur input
 */
window.Ledger = window.Ledger || {};

Ledger.shortcuts = (function () {
  "use strict";

  function isTypingTarget(el) {
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  /**
   * @param {Object} handlers
   * @param {HTMLElement} handlers.input
   * @param {HTMLElement} handlers.backdrop
   * @param {() => void} handlers.onToggleTheme
   * @param {(filter:string) => void} handlers.onSetFilter
   * @param {() => void} handlers.onUndo
   */
  function init({
    input,
    backdrop,
    shortcutsBtn,
    onToggleTheme,
    onSetFilter,
    onUndo,
    onOpenPalette,
    onToggleFocus,
  }) {
    const panelEl = backdrop.querySelector(".modal");
    const trap = Ledger.utils.trapFocus(panelEl);

    function openPanel() {
      backdrop.classList.add("show");
      trap.activate();
    }
    function closePanel() {
      backdrop.classList.remove("show");
      trap.deactivate();
    }
    function togglePanel() {
      backdrop.classList.contains("show") ? closePanel() : openPanel();
    }

    shortcutsBtn.addEventListener("click", togglePanel);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePanel();
    });

    document.addEventListener("keydown", (e) => {
      const meta = e.metaKey || e.ctrlKey;

      // Always-available combos, even while typing.
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        onUndo();
        return;
      }
      if (e.key === "Escape") {
        if (backdrop.classList.contains("show")) closePanel();
        else input.blur();
        return;
      }

      // Everything below is suppressed while the user is typing.
      if (isTypingTarget(document.activeElement)) return;

      if (e.key === "?") {
        e.preventDefault();
        togglePanel();
        return;
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        input.focus();
        input.select();
        return;
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        onToggleFocus();
        return;
      }
      if (e.key === "1") onSetFilter("all");
      if (e.key === "2") onSetFilter("active");
      if (e.key === "3") onSetFilter("completed");
      if (e.key.toLowerCase() === "t") onToggleTheme();
    });

    return { openPanel, closePanel };
  }

  return { init };
})();
