import React from "react";
import Modal from "@/components/ui/Modal";

type FirstRunJournalModalProps = {
  open: boolean;
  firstRunName: string;
  firstRunSaving: boolean;
  firstRunError: string | null;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
};

export default function FirstRunJournalModal({
  open,
  firstRunName,
  firstRunSaving,
  firstRunError,
  onClose,
  onNameChange,
  onSave,
}: FirstRunJournalModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Name your journal"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={firstRunSaving}
            className="rounded-xl bg-green-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            {firstRunSaving ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      <div className="grid gap-2">
        <p className="text-sm text-gray-600">
          Choose a name for your first journal. You can manage journals later in “Manage Journals”.
        </p>
        <input
          value={firstRunName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Crypto Journal"
          className="w-full rounded-xl border border-gray-200 px-3 py-2"
          autoFocus
        />
        {firstRunError && <p className="text-xs text-red-600">{firstRunError}</p>}
      </div>
    </Modal>
  );
}
