#!/usr/bin/env node
/**
 * tests/run.js — run the full suite: `node tests/run.js`
 * (also wired up as `npm test` — see package.json)
 */
"use strict";
require("./utils.test.js");
require("./store.test.js");
const { summary } = require("./tiny-test");
summary();
