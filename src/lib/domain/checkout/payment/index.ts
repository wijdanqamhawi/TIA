import type { PaymentMethodType } from "@/types/order";

/**
 * Payment abstraction (T119, research.md §10, spec FR-022): an extensible
 * `PaymentMethod` discriminated union + provider registry so a future
 * online payment method can be added without redesigning checkout or the
 * order-creation transaction. `CashOnDeliveryProvider` is the only
 * implementation for launch.
 */

export type PaymentMethod = { type: PaymentMethodType };

export interface PaymentProvider {
  readonly type: PaymentMethodType;
  isEnabled(): boolean;
}

export class CashOnDeliveryProvider implements PaymentProvider {
  readonly type = "CASH_ON_DELIVERY" as const;
  isEnabled(): boolean {
    return true;
  }
}

const PROVIDERS: Record<PaymentMethodType, PaymentProvider> = {
  CASH_ON_DELIVERY: new CashOnDeliveryProvider(),
};

/**
 * Validates that `type` names an enabled payment method and returns the
 * normalized value to store on the order document — never trusts the
 * client-submitted value beyond this lookup (Constitution Principle 13).
 * Returns `null` for an unknown or currently-disabled method.
 */
export function resolvePaymentMethod(type: string): PaymentMethod | null {
  const provider = PROVIDERS[type as PaymentMethodType];
  if (!provider || !provider.isEnabled()) {
    return null;
  }
  return { type: provider.type };
}
