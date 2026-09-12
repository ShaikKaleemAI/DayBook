/**
 * gestures.js — touch swipe-to-complete / swipe-to-delete for mobile.
 * Swipe right past threshold -> complete. Swipe left past threshold -> delete.
 * Desktop (mouse) is unaffected; this only listens to touch events.
 */
window.Ledger = window.Ledger || {};

Ledger.gestures = (function () {
  "use strict";

  const THRESHOLD = 72; // px to trigger an action
  const MAX_DRAG = 120;

  function attach(row, { onComplete, onDelete }) {
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dragging = false;
    let axisLocked = null; // 'x' | 'y' | null

    row.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        if (row.classList.contains("select-mode")) return; // tapping selects instead of swiping
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        dx = 0;
        dragging = true;
        axisLocked = null;
        row.classList.add("swiping");
      },
      { passive: true }
    );

    row.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging) return;
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const rawDx = x - startX;
        const rawDy = y - startY;

        if (!axisLocked) {
          if (Math.abs(rawDx) < 6 && Math.abs(rawDy) < 6) return;
          axisLocked = Math.abs(rawDx) > Math.abs(rawDy) ? "x" : "y";
        }
        if (axisLocked !== "x") return; // let vertical scroll happen normally

        e.preventDefault();
        dx = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, rawDx));
        row.style.transform = `translateX(${dx}px)`;
        row.classList.toggle("swipe-complete", dx > THRESHOLD);
        row.classList.toggle("swipe-delete", dx < -THRESHOLD);
      },
      { passive: false }
    );

    function reset() {
      dragging = false;
      axisLocked = null;
      row.classList.remove("swiping", "swipe-complete", "swipe-delete");
      row.style.transform = "";
    }

    row.addEventListener("touchend", () => {
      if (!dragging) return;
      if (dx > THRESHOLD) {
        row.style.transform = `translateX(${MAX_DRAG + 40}px)`;
        row.style.opacity = "0";
        setTimeout(onComplete, 140);
      } else if (dx < -THRESHOLD) {
        row.style.transform = `translateX(-${MAX_DRAG + 40}px)`;
        row.style.opacity = "0";
        setTimeout(onDelete, 140);
      } else {
        reset();
      }
      dragging = false;
    });

    row.addEventListener("touchcancel", reset);
  }

  return { attach };
})();
