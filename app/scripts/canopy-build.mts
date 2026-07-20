/**
 * Canopy build and development orchestration entry point
 *
 * This wrapper delegates to @canopy-iiif/app's orchestrator so the published
 * package manages core logic. Keeping the entry small ensures the generated
 * template which consumes the published package can stay up to date.
 *
 * See https://github.com/nulib-ds/canopy for more information.
 *
 * @license MIT
 * Copyright (c) 2025 Mat Jordan
 */

import {orchestrate} from "@canopy-iiif/app/orchestrator";

const err = (msg: string): void => {
  console.error(`[canopy][error] ${msg}`);
};

orchestrate().catch((error: unknown) => {
  const message =
    error &&
    typeof error === "object" &&
    "stack" in error &&
    typeof error.stack === "string"
      ? error.stack
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : String(error);
  err(message);
  process.exit(1);
});
