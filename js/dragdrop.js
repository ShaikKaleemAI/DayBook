/**
 * dragdrop.js — native HTML5 drag-and-drop for reordering rows.
 * No library: dragstart/dragover/drop/dragend on the row itself,
 * using the drag handle as the visual affordance.
 */
window.Ledger = window.Ledger || {};

Ledger.dragdrop = (function () {
  "use strict";

  /**
   * Wires drag events onto a single <li> row.
   * @param {HTMLElement} row
   * @param {string} taskId
   * @param {(fromId:string, toId:string|null) => void} onDrop
   */
  function attach(row, taskId, onDrop) {
    row.setAttribute("draggable", "true");

    row.addEventListener("dragstart", (e) => {
      if (row.classList.contains("select-mode")) {
        e.preventDefault();
        return;
      }
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", taskId);
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-over");
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over");
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const fromId = e.dataTransfer.getData("text/plain");
      if (!fromId || fromId === taskId) return;
      onDrop(fromId, taskId);
    });
  }

  return { attach };
})();
