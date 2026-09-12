/**
 * toast.js — small "Task deleted · Undo" style notifications.
 * Keeps destructive actions (delete, clear completed) non-destructive
 * for a few seconds, matching the undo pattern used by mature apps.
 */
window.Ledger = window.Ledger || {};

Ledger.toast = (function () {
  "use strict";

  let region;

  function init(regionEl) {
    region = regionEl;
  }

  /**
   * @param {Object} opts
   * @param {string} opts.message
   * @param {string} [opts.actionLabel]
   * @param {Function} [opts.onAction]
   * @param {number} [opts.duration=5000]
   */
  function show({ message, actionLabel, onAction, duration = 5000 }) {
    if (!region) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");

    const msg = document.createElement("span");
    msg.className = "toast__msg";
    msg.textContent = message;
    toast.appendChild(msg);

    let timer;
    const dismiss = () => {
      clearTimeout(timer);
      toast.classList.add("leaving");
      toast.addEventListener(
        "animationend",
        () => toast.remove(),
        { once: true }
      );
      setTimeout(() => toast.remove(), 250); // fallback
    };

    if (actionLabel && onAction) {
      const btn = document.createElement("button");
      btn.className = "toast__action";
      btn.type = "button";
      btn.textContent = actionLabel;
      btn.addEventListener("click", () => {
        onAction();
        dismiss();
      });
      toast.appendChild(btn);
    }

    const close = document.createElement("button");
    close.className = "toast__close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    close.addEventListener("click", dismiss);
    toast.appendChild(close);

    region.appendChild(toast);
    timer = setTimeout(dismiss, duration);
  }

  return { init, show };
})();
