import { expect, it } from "vitest";

import worker from "../src/index.ts";

it("exposes no production API from the Phase 0-only worker shell", async () => {
  const response = worker.fetch();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    code: "PHASE0_LOCAL_SPIKE_ONLY",
    deployed: false,
  });
});
