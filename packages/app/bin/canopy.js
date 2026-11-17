#!/usr/bin/env node
'use strict';

// `canopy build` and `canopy dev` (`lib/cli.js`).
const {run} = require('../lib/cli');

run(process.argv.slice(2)).then(
  (code) => {
    if (code) process.exitCode = code;
  },
  (error) => {
    const message = (error && (error.stack || error.message)) || String(error);
    console.error(`[canopy][error] ${message}`);
    process.exit(1);
  },
);
