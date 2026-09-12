/**
 * tests/tiny-test.js — a ~40-line test runner. No Jest, no Mocha.
 * The app ships with zero runtime dependencies on principle; the test
 * tooling follows the same rule. `node tests/run.js` is all you need.
 */
"use strict";

const results = { pass: 0, fail: 0 };
let currentSuite = "";

function describe(name, fn) {
  currentSuite = name;
  fn();
}

function it(name, fn) {
  try {
    fn();
    results.pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${currentSuite} — ${name}`);
  } catch (err) {
    results.fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${currentSuite} — ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg ? msg + " — " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value, msg) {
  if (!value) throw new Error(msg || `expected truthy value, got ${JSON.stringify(value)}`);
}

function assertThrows(fn, msg) {
  try {
    fn();
  } catch (e) {
    return;
  }
  throw new Error(msg || "expected function to throw, but it did not");
}

function summary() {
  const total = results.pass + results.fail;
  console.log(`\n${results.pass}/${total} passed`);
  if (results.fail > 0) process.exitCode = 1;
}

module.exports = { describe, it, assertEqual, assertTrue, assertThrows, summary };
