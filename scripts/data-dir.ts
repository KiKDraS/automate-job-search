#!/usr/bin/env node
/** Print the resolved data directory (JOBSEARCH_HOME or ~/.jobsearch). */
import { resolveDataDir } from "../lib/data-dir.ts"

console.log(resolveDataDir())
