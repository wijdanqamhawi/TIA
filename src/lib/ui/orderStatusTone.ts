import type { OrderStatus } from "@/types/order";

/**
 * One muted tint (pill + dot) per real order status — never saturated. Pure
 * data, so the admin Orders list (a client component) and the customer order
 * pages (server components) share the exact same colours.
 */
export const ORDER_STATUS_TONE: Record<OrderStatus, { pill: string; dot: string }> = {
  PENDING: { pill: "bg-brand-gold/[0.18] text-brand-gold-ink", dot: "bg-brand-gold" },
  CONFIRMED: { pill: "bg-[#e8edf6] text-[#2f4a7a]", dot: "bg-[#4a6ba3]" },
  PREPARING: { pill: "bg-[#e3eef5] text-[#2a5a78]", dot: "bg-[#3f83a8]" },
  SHIPPED: { pill: "bg-[#ece8f5] text-[#54427f]", dot: "bg-[#7a62b0]" },
  DELIVERED: { pill: "bg-[#e6f0e9] text-[#2f6844]", dot: "bg-[#3f7a55]" },
  CANCELLED: { pill: "bg-[#f7e8e6] text-[#963a33]", dot: "bg-[#c0574d]" },
};
