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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick Close"
      footer={
        <div className="flex justify-end gap-3">
          <button className="rounded bg-gray-100 px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={closing}
            className="rounded bg-red-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            Close Trade
          </button>
        </div>
      }
    >
      {rowToClose && (
        <div className="grid gap-3 pr-1">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Entry</div>
              <div className="font-mono">{fmt4(rowToClose.entry_price)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Exit</div>
              <MoneyInputStandalone
                valueRaw={closeExit}
                onChangeRaw={onCloseExitChange}
                placeholder="0"
                maxDecimals={8}
                className={`w-full rounded-xl border px-3 py-2 ${
                  closeExitError ? "border-red-500" : "border-gray-200"
                }`}
              />

              {closeExitError && (
                <div className="mt-1 text-xs text-red-600">{closeExitError}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500">PnL (net)</div>
              <div className="font-mono">{closePnl != null ? money2(closePnl) : "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">
                Trading Fee <span className="text-red-600">*</span>
              </div>

              <MoneyInputStandalone
                valueRaw={closeTradingFee}
                onChangeRaw={onCloseTradingFeeChange}
                placeholder="0"
                className={`w-full rounded-xl border px-3 py-2 ${
                  closeFeeError ? "border-red-500" : "border-gray-200"
                }`}
                maxDecimals={2}
              />

              {closeFeeError && <div className="mt-1 text-xs text-red-600">{closeFeeError}</div>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
