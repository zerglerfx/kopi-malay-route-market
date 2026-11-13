import { describe, expect, it } from "vitest";
import { actionsFor, canTransition } from "@/lib/order-flow";

describe("strict order flow", () => {
  it("pending verification can only be verified or rejected", () => expect(actionsFor("pending_verification")).toEqual(["verify", "reject"]));
  it("verified can only be shipped", () => expect(actionsFor("verified")).toEqual(["ship"]));
  it("shipped can be received or have tracking corrected", () => expect(actionsFor("shipped")).toEqual(["complete", "tracking"]));
  it("completed and rejected are final", () => { expect(actionsFor("completed")).toEqual([]); expect(actionsFor("rejected")).toEqual([]); });
  it("cannot jump from pending verification to completed", () => expect(canTransition("pending_verification", "complete")).toBe(false));
  it("cannot ship before verification", () => expect(canTransition("pending_verification", "ship")).toBe(false));
});
