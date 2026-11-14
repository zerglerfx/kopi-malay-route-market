import { describe, expect, it } from "vitest";
import { bestPlace, rankPlaces } from "@/lib/place-match";
import { MY_STATES, TH_PROVINCES } from "@/lib/shop";

describe("state/province search", () => {
  it("snaps a misspelling to the closest province", () => { expect(bestPlace("chang mai", TH_PROVINCES)).toBe("Chiang Mai"); });
  it("prefix typing ranks the match first", () => { expect(rankPlaces("sel", MY_STATES)[0]).toBe("Selangor"); });
  it("returns nothing for gibberish", () => { expect(bestPlace("zzzzzzzz", MY_STATES)).toBe(""); });
});
