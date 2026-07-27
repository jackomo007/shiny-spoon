import React from "react";
import Modal from "@/components/ui/Modal";
import { MoneyInputStandalone } from "@/components/form/MaskedFields";
import type { JournalRow } from "@/app/(app)/journal/journal-client";

type QuickCloseModalProps = {
  open: boolean;
  closing: boolean;
  rowToClose: JournalRow | null;
  closeExit: string;
  closeTradingFee: string;
  closePnl: number | null;
  closeExitError: string | null;
  closeFeeError: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onCloseExitChange: (value: string) => void;
  onCloseTradingFeeChange: (value: string) => void;
  fmt4: (n: number | null | undefined) => string;
  money2: (n: number) => string;
};

export default function QuickCloseModal({
  open,
  closing,
  rowToClose,
  closeExit,
  closeTradingFee,
  closePnl,
  closeExitError,
  closeFeeError,
  onClose,
  onSubmit,
  onCloseExitChange,
  onCloseTradingFeeChange,
  fmt4,
  money2,
}: QuickCloseModalProps) {
  const pnlIsPositive = closePnl != null && closePnl >= 0;
  const pnlTone = pnlIsPositive
    ? {
        card: "border-emerald-200 bg-emerald-50/80",
        value: "text-emerald-700",
        icon: "bg-emerald-100 text-emerald-700",
        button: "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-200",
      }
    : {
        card: "border-red-200 bg-red-50/80",
        value: "text-red-600",
        icon: "bg-red-100 text-red-600",
        button: "bg-red-600 hover:bg-red-700 focus-visible:outline-red-200",
      };
  const pnlPercent =
    closePnl != null && rowToClose && rowToClose.amount_spent > 0
      ? (closePnl / rowToClose.amount_spent) * 100
      : null;
  const pnlValue =
    closePnl != null
      ? `${closePnl >= 0 ? "+" : "-"}${money2(Math.abs(closePnl))}`
      : "-";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick Close"
      widthClass="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-11 rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={closing}
            className={`h-11 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 ${pnlTone.button}`}
            type="button"
          >
            {closing ? "Closing..." : "Close Trade"}
          </button>
        </div>
      }
    >
      {rowToClose && (
        <div className="grid gap-5 pr-1">
          <p className="-mt-1 text-sm text-gray-500">
            Confirm your closing details before completing the trade.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-gray-600">Entry Price</div>
              <div className="flex h-12 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 font-mono font-semibold text-gray-900">
                ${fmt4(rowToClose.entry_price)}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-gray-600">Exit Price</div>
              <MoneyInputStandalone
                valueRaw={closeExit}
                onChangeRaw={onCloseExitChange}
                placeholder="0"
                maxDecimals={8}
                className={`h-12 w-full rounded-xl border px-3 font-semibold ${
                  closeExitError ? "border-red-500" : "border-gray-200"
                }`}
              />

              {closeExitError && (
                <div className="mt-1 text-xs text-red-600">{closeExitError}</div>
              )}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-gray-600">Stop Loss</div>
              <div className="flex h-12 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 font-mono font-semibold text-gray-900">
                {rowToClose.stop_loss_price != null ? `$${fmt4(rowToClose.stop_loss_price)}` : "-"}
              </div>
              <div className="mt-1 text-xs text-gray-500">Recorded for trade analysis.</div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-gray-600">
                Trading Fee <span className="text-red-600">*</span>
              </div>

              <MoneyInputStandalone
                valueRaw={closeTradingFee}
                onChangeRaw={onCloseTradingFeeChange}
                placeholder="0"
                className={`h-12 w-full rounded-xl border px-3 font-semibold ${
                  closeFeeError ? "border-red-500" : "border-gray-200"
                }`}
                maxDecimals={8}
              />

              {closeFeeError && <div className="mt-1 text-xs text-red-600">{closeFeeError}</div>}
            </div>
          </div>

          <section
            className={`flex items-center justify-between gap-4 rounded-2xl border p-5 ${pnlTone.card}`}
            aria-live="polite"
          >
            <div>
              <div className="mb-1 text-sm font-bold text-gray-600">PnL (Net)</div>
              <div className={`font-mono text-3xl font-extrabold tabular-nums ${pnlTone.value}`}>
                {pnlValue}
              </div>
              <div className={`mt-2 text-sm font-bold ${pnlTone.value}`}>
                {pnlPercent != null
                  ? `${pnlPercent >= 0 ? "+" : "-"}${Math.abs(pnlPercent).toFixed(2)}%`
                  : "-"}
              </div>
            </div>

            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${pnlTone.icon}`}>
              <svg
                aria-hidden="true"
                className={`h-6 w-6 ${pnlIsPositive ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 6l7 7 4-4 5 5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.25"
                />
                <path
                  d="M15 14h5V9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.25"
                />
              </svg>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
