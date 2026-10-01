import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/types/order";
import { buildOrderTimeline, TIMELINE_PATH } from "@/lib/domain/orders/order-timeline";
import { getAllowedNextStatuses } from "@/lib/domain/orders/order-status-transitions";

describe("buildOrderTimeline", () => {
  it("the path is the ordinary linear flow, without Cancelled", () => {
    expect(TIMELINE_PATH).toEqual(["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]);
  });

  it("marks everything before the current status done, the current one current, the rest upcoming", () => {
    for (const status of TIMELINE_PATH) {
      const index = TIMELINE_PATH.indexOf(status);
      const steps = buildOrderTimeline(status);
      expect(steps).toHaveLength(5);
      steps.forEach((step, i) => {
        expect(step.state).toBe(i < index ? "done" : i === index ? "current" : "upcoming");
      });
    }
  });

  it("only the placement step ever has a time", () => {
    for (const status of ORDER_STATUSES) {
      const timed = buildOrderTimeline(status).filter((step) => step.hasPlacedTime);
      expect(timed.map((s) => s.status)).toEqual(["PENDING"]);
    }
  });

  it("a cancelled order shows just placement and cancellation (the steps between are unknowable)", () => {
    expect(buildOrderTimeline("CANCELLED")).toEqual([
      { status: "PENDING", state: "done", hasPlacedTime: true },
      { status: "CANCELLED", state: "current", hasPlacedTime: false },
    ]);
  });

  it("agrees with the real transition table: the ordinary path cannot skip a step", () => {
    // The assumption behind "every earlier step happened".
    for (let i = 0; i < TIMELINE_PATH.length - 1; i++) {
      expect(getAllowedNextStatuses(TIMELINE_PATH[i])).toContain(TIMELINE_PATH[i + 1]);
      for (const next of getAllowedNextStatuses(TIMELINE_PATH[i])) {
        expect([TIMELINE_PATH[i + 1], "CANCELLED"]).toContain(next);
      }
    }
  });
});
