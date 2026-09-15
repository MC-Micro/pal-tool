import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/shared/canonical-json.ts";

describe("canonical JSON", () => {
  it("orders object keys by explicit code-unit order", () => {
    expect(canonicalJson({ A: 3, a: 4, z: 2, ä: 1 })).toBe(
      '{"A":3,"a":4,"z":2,"ä":1}',
    );
  });
});
