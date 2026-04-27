#!/usr/bin/env bun

import { main } from '../src/index.js';

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exit(1);
});
