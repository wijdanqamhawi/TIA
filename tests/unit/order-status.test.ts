import { describe, expect, it } from "vitest";
import {
  getAllowedNextStatuses,
  isValidOrderStatusTransition,
} from "@/lib/domain/orders/order-status-transitions";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";

/** T173: the order-status transition validator rejects invalid transitions. */
describe("isValidOrderStatusTransition", () => {
  it("allows the normal forward-progress path", () => {
    expect(isValidOrderStatusTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(isValidOrderStatusTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(isValidOrderStatusTransition("PREPARING", "SHIPPED")).toBe(true);
    expect(isValidOrderStatusTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("allows cancellation from every non-terminal status", () => {
    expect(isValidOrderStatusTransition("PENDING", "CANCELLED")).toBe(true);
    expect(isValidOrderStatusTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(isValidOrderStatusTransition("PREPARING", "CANCELLED")).toBe(true);
  });

  it("rejects skipping a step forward", () => {
    expect(isValidOrderStatusTransition("PENDING", "PREPARING")).toBe(false);
    expect(isValidOrderStatusTransition("PENDING", "SHIPPED")).toBe(false);
    expect(isValidOrderStatusTransition("CONFIRMED", "DELIVERED")).toBe(false);
  });

  it("rejects moving backward", () => {
    expect(isValidOrderStatusTransition("SHIPPED", "CONFIRMED")).toBe(false);
    expect(isValidOrderStatusTransition("DELIVERED", "SHIPPED")).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    for (const status of ORDER_STATUSES) {
      expect(isValidOrderStatusTransition("DELIVERED", status)).toBe(false);
      expect(isValidOrderStatusTransition("CANCELLED", status)).toBe(false);
    }
  });

  it("rejects a transition to the same status", () => {
    for (const status of ORDER_STATUSES) {
      expect(isValidOrderStatusTransition(status, status)).toBe(false);
    }
  });

  it("cannot cancel a SHIPPED order (already out for delivery)", () => {
    expect(isValidOrderStatusTransition("SHIPPED", "CANCELLED")).toBe(false);
  });
});

describe("getAllowedNextStatuses", () => {
  it("returns no options for a terminal status", () => {
    expect(getAllowedNextStatuses("DELIVERED")).toEqual([]);
    expect(getAllowedNextStatuses("CANCELLED")).toEqual([]);
  });

  it("every allowed next status is a valid transition", () => {
    for (const status of ORDER_STATUSES) {
      for (const next of getAllowedNextStatuses(status)) {
        expect(isValidOrderStatusTransition(status, next as OrderStatus)).toBe(true);
      }
    }
  });
});
