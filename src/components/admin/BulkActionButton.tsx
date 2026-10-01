"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useTranslations } from "next-intl";
import { deleteAllProductsAction, removeAllOffersAction } from "@/actions/admin/bulk.actions";
import type { ActionResult } from "@/lib/validation/common";

export type BulkKind = "products" | "offers";

const KINDS = {
  products: { namespace: "AdminProducts", run: deleteAllProductsAction },
  offers: { namespace: "AdminOffers", run: removeAllOffersAction },
} as const;

/**
 * A page-level bulk action (Delete All / Remove All): a compact red-outlined button that opens a
 * confirmation dialog naming the exact record count and warning that it cannot be undone. The action
 * runs only after an explicit confirm; while it runs both the button and the dialog are inert and a
 * second click is ignored. On success the server data is refreshed — so the table and the summary cards
 * re-render from the real state — and a notice confirms the outcome; on failure the dialog stays open
 * with the reason (a partial failure says how many were already done).
 *
 * It decides nothing: the server action re-checks the permission and that the count is still what was
 * confirmed.
 */
export function BulkActionButton({
  kind,
  count,
  className,
}: {
  kind: BulkKind;
  /** How many records the action will affect — shown in the dialog and re-checked by the server. */
  count: number;
  className?: string;
}) {
  const { namespace, run } = KINDS[kind];
  const t = useTranslations(`${namespace}.bulk`);
  const labels = {
    button: t("button"),
    title: t("title"),
    description: t("description", { count }),
    confirm: t("confirm"),
    cancel: t("cancel"),
    success: t("success", { count }),
    // Only the products action reports image cleanup, so only that namespace has these strings.
    successImagesFailed: (failed: number) => t("successImagesFailed", { count, failed }),
    errors: {
      generic: t("errors.generic"),
      forbidden: t("errors.forbidden"),
      staleCount: t("errors.staleCount"),
      partial: (done: number, remaining: number) => t("errors.partial", { done, remaining }),
      imagesNote: (failed: number) => t("errors.imagesNote", { failed }),
    },
  };
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `warn` — the action succeeded but something was left behind (e.g. image files in Storage).
  const [notice, setNotice] = useState<{ text: string; warn: boolean } | null>(null);
  const inFlight = useRef(false);

  function message(result: Extract<ActionResult<unknown>, { ok: false }>): string {
    const { code, fieldErrors } = result.error;
    if (code === "FORBIDDEN") return labels.errors.forbidden;
    if (code === "STALE_COUNT") return labels.errors.staleCount;
    if (code === "PARTIAL_FAILURE") {
      const imagesFailed = Number(fieldErrors?.imagesFailed?.[0] ?? 0);
      return [
        labels.errors.partial(
          Number(fieldErrors?.done?.[0] ?? 0),
          Number(fieldErrors?.remaining?.[0] ?? 0),
        ),
        imagesFailed > 0 ? labels.errors.imagesNote(imagesFailed) : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    return labels.errors.generic;
  }

  async function confirm() {
    if (inFlight.current) return; // no double submits
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      let result: Awaited<ReturnType<typeof run>>;
      try {
        result = await run({ expectedCount: count });
      } catch {
        setError(labels.errors.generic);
        return;
      }
      if (result.ok) {
        setOpen(false);
        const imagesFailed = result.data.imagesFailed ?? 0;
        // Never "all deleted" when some image files could not be removed: say what actually happened.
        setNotice(
          imagesFailed > 0
            ? { text: labels.successImagesFailed(imagesFailed), warn: true }
            : { text: labels.success, warn: false },
        );
        router.refresh();
      } else {
        setError(message(result));
        // A partial run or a stale count changed / revealed the real state: show it behind the dialog.
        if (result.error.code === "PARTIAL_FAILURE" || result.error.code === "STALE_COUNT")
          router.refresh();
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <button
          type="button"
          data-testid="bulk-action-button"
          disabled={count === 0 || pending}
          onClick={() => {
            setNotice(null);
            setError(null);
            setOpen(true);
          }}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#c0574d]/50 bg-white px-4 text-[14px] font-medium text-[#a23f36] outline-none transition-colors hover:border-[#c0574d] hover:bg-[#fbf1ef] focus-visible:ring-2 focus-visible:ring-[#c0574d]/40 disabled:cursor-not-allowed disabled:border-brand-burgundy/10 disabled:bg-brand-cream disabled:text-text-secondary",
            className,
          )}
        >
          <Trash2 aria-hidden="true" className="size-[16px] stroke-[1.8]" />
          {labels.button}
        </button>
        {notice ? (
          <p
            role="status"
            data-testid="bulk-notice"
            data-warn={notice.warn}
            className={cn(
              "max-w-[360px] text-[12.5px] leading-snug sm:text-end",
              notice.warn ? "text-[#7a5416]" : "text-[#2f6844]",
            )}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {open ? (
        <ConfirmDialog
          titleId="bulk-action-title"
          title={labels.title}
          description={labels.description}
          cancelLabel={labels.cancel}
          confirmLabel={labels.confirm}
          pending={pending}
          error={error}
          onCancel={() => {
            if (!pending) setOpen(false);
          }}
          onConfirm={confirm}
        />
      ) : null}
    </>
  );
}
