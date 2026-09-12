/**
 * theme.js — "night ledger" vs "day paper" theme switching.
 */
window.Ledger = window.Ledger || {};

Ledger.theme = (function () {
  "use strict";

  const THEME_KEY = "ledger.theme";
  let toggleBtn;

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (toggleBtn) {
      toggleBtn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to paper mode" : "Switch to night mode"
      );
      toggleBtn.setAttribute("aria-pressed", String(theme === "light"));
    }
  }

  function save(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function toggle() {
    const next = current() === "dark" ? "light" : "dark";
    apply(next);
    save(next);
  }

  function init(btnEl) {
    toggleBtn = btnEl;
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      /* ignore */
    }

    if (saved === "dark" || saved === "light") {
      apply(saved);
    } else {
      // Default to the professional white theme; only defer to night
      // ledger when the OS explicitly prefers dark.
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      apply(prefersDark ? "dark" : "light");
    }

    toggleBtn.addEventListener("click", toggle);
  }

  return { init, toggle, current };
})();
