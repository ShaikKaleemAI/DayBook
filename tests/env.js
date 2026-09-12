/**
 * tests/env.js — a deliberately tiny browser shim.
 *
 * The app has zero runtime dependencies by design (see README), so the
 * test suite matches that constraint: no jsdom, no test framework, just
 * enough of `window`, `localStorage`, and `EventTarget` for store.js and
 * utils.js to run unmodified under plain `node`. render.js and app.js
 * (real DOM manipulation) are intentionally out of scope for this layer;
 * they're covered by manual/E2E testing instead. This file must be
 * required before store.js / utils.js in any test.
 */
"use strict";

class MemoryStorage {
  constructor() {
    this._data = new Map();
  }
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }
  setItem(key, value) {
    this._data.set(key, String(value));
  }
  removeItem(key) {
    this._data.delete(key);
  }
  clear() {
    this._data.clear();
  }
}

// Node has a global EventTarget (since v15+), so Store extending it works
// as-is. We only need to fill in `window` and `localStorage`.
global.window = global.window || {};
global.localStorage = new MemoryStorage();
global.window.localStorage = global.localStorage;

// store.js and utils.js reference the bare identifier `Ledger` (a global
// in the browser, since `window.Ledger = ...` creates a global property).
// Node's CommonJS module scope doesn't do that automatically, so mirror
// it explicitly as a true global bound to the same object.
global.window.Ledger = global.window.Ledger || {};
global.Ledger = global.window.Ledger;

// Reset just the persisted state between tests without re-requiring
// the modules (which would double-register on window.Ledger).
function resetStorage() {
  global.localStorage.clear();
}

module.exports = { resetStorage, MemoryStorage };
