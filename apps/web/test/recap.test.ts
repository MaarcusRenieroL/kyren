import { describe, expect, it } from "vitest";

import { recapActionItems } from "../src/components/meetings/recap";

describe("recapActionItems", () => {
  it("reads the bullets under the Action items heading", () => {
    expect(
      recapActionItems(
        "We agreed on the launch date.\n\nDecisions:\n- Ship Friday\n\nAction items:\n- Ana writes the release note\n* Ben updates the pricing page\n1. Cy books the demo\n\nThanks all.",
      ),
    ).toEqual([
      "Ana writes the release note",
      "Ben updates the pricing page",
      "Cy books the demo",
    ]);
  });

  it("finds nothing without the heading, or with an empty list", () => {
    expect(recapActionItems("Decisions:\n- Ship Friday")).toEqual([]);
    expect(recapActionItems("Action items:\n\nNone yet.")).toEqual([]);
    expect(recapActionItems(null)).toEqual([]);
  });

  it("accepts a bold heading", () => {
    expect(recapActionItems("**Action items:**\n- Follow up")).toEqual([
      "Follow up",
    ]);
  });
});
